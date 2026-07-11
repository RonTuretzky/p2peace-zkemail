import { bytesToHex } from "viem";

/**
 * Browser-side DKIM parser + relaxed header canonicalizer.
 *
 * Turns an uploaded .eml file into the exact (signedHeaders, signature) that
 * the on-chain RealEmailVerifier expects. The canonicalization byte-exactly
 * reproduces the RFC 6376 sec 3.4.2 relaxed header algorithm (the same one the
 * known-good Python reference produced).
 *
 * No Node-only APIs: uses TextEncoder + atob + viem's bytesToHex so it runs in
 * the browser unchanged.
 */

export interface ParsedEmail {
  signedHeaders: `0x${string}`;
  signature: `0x${string}`;
  domain: string;
  selector: string;
  from: string;
}

/** A conversion receipt also carries the raw body (the ExitReceiptVerifier
 *  re-hashes it against the DKIM bh= tag, so the amount + destination address in
 *  the body are covered by the signature). */
export interface ParsedReceipt extends ParsedEmail {
  body: `0x${string}`;
}

interface RawHeader {
  /** header field name, exactly as it appeared (case preserved) */
  name: string;
  /** header field value, including any folded continuation lines, WITHOUT the
   *  leading name+colon, and WITHOUT the trailing line break */
  value: string;
}

interface DkimSig {
  header: RawHeader;
  tags: Map<string, string>;
  domain: string;
  selector: string;
  hList: string[];
  bValue: string;
}

const encoder = new TextEncoder();

function toText(raw: string | Uint8Array): string {
  if (typeof raw === "string") return raw;
  // Decode as latin1/binary so every byte round-trips 1:1. Email header bytes
  // are ASCII for the parts we canonicalize; encoded-words stay as raw bytes.
  let out = "";
  for (let i = 0; i < raw.length; i++) out += String.fromCharCode(raw[i]);
  return out;
}

/**
 * Split the message into its header block and body at the first blank line.
 * Handles both CRLF CRLF and LF LF separators. Returns the header block with
 * line breaks preserved.
 */
function splitHeaders(text: string): string {
  const crlf = text.indexOf("\r\n\r\n");
  const lf = text.indexOf("\n\n");
  let idx = -1;
  if (crlf !== -1 && lf !== -1) idx = Math.min(crlf, lf);
  else if (crlf !== -1) idx = crlf;
  else if (lf !== -1) idx = lf;
  if (idx === -1) return text; // no body; whole thing is headers
  return text.slice(0, idx);
}

/**
 * Parse the header block into an ordered list of raw headers. Continuation
 * lines (a line beginning with SP or TAB) are appended to the preceding
 * header's value, keeping the original line breaks so relaxed unfolding can
 * collapse them exactly like the reference regex does.
 */
function parseHeaders(headerBlock: string): RawHeader[] {
  // Normalize line endings for splitting only; we re-inject the exact form the
  // relaxed canonicalizer expects (it treats \r?\n uniformly).
  const lines = headerBlock.split(/\r\n|\n/);
  const headers: RawHeader[] = [];
  for (const line of lines) {
    if (line === "") continue;
    if (line[0] === " " || line[0] === "\t") {
      // continuation of the previous header
      if (headers.length > 0) {
        headers[headers.length - 1].value += "\r\n" + line;
      }
      continue;
    }
    const colon = line.indexOf(":");
    if (colon === -1) {
      // Malformed line; treat as continuation of previous if any.
      if (headers.length > 0) headers[headers.length - 1].value += "\r\n" + line;
      continue;
    }
    const name = line.slice(0, colon);
    // Value is everything after the colon (including a possible leading space);
    // relaxed canonicalization strips leading/trailing WSP anyway.
    const value = line.slice(colon + 1);
    headers.push({ name, value });
  }
  return headers;
}

/**
 * Parse DKIM-Signature tag=value pairs. Values may span folded lines; the
 * caller passes the already-unfolded-ish raw value. We tolerate embedded
 * whitespace inside tag values by stripping WSP from tag values except where it
 * is semantically meaningful (b=, bh= base64 we strip all WSP; h= we strip WSP
 * around colons).
 */
function parseDkimTags(rawValue: string): Map<string, string> {
  const tags = new Map<string, string>();
  // Collapse folding: turn any CR/LF + WSP runs into nothing-significant. We
  // split on ';' then on the first '='.
  const parts = rawValue.split(";");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === "") continue;
    let val = part.slice(eq + 1);
    // Strip all whitespace (incl. folded line breaks) from tag values. For the
    // tags we care about (d, s, h, b) this is correct: none contain meaningful
    // internal whitespace.
    val = val.replace(/[\s]+/g, "");
    tags.set(key, val);
  }
  return tags;
}

function findDkimSignatures(headers: RawHeader[]): DkimSig[] {
  const sigs: DkimSig[] = [];
  for (const h of headers) {
    if (h.name.toLowerCase() !== "dkim-signature") continue;
    const tags = parseDkimTags(h.value);
    const domain = tags.get("d") ?? "";
    const selector = tags.get("s") ?? "";
    const hRaw = tags.get("h") ?? "";
    const bValue = tags.get("b") ?? "";
    const hList = hRaw
      .split(":")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    sigs.push({ header: h, tags, domain, selector, hList, bValue });
  }
  return sigs;
}

/**
 * Relaxed header canonicalization of a single header (RFC 6376 sec 3.4.2),
 * byte-exact with the Python reference:
 *   n = name.lower().strip()
 *   v = re.sub(rb'\r?\n[ \t]+', b' ', value)   # unfold
 *   v = re.sub(rb'[ \t]+', b' ', v).strip()      # collapse WSP
 *   return n + b':' + v + b'\r\n'
 */
function relaxedHeader(name: string, value: string): string {
  const n = name.toLowerCase().trim();
  let v = value.replace(/\r?\n[ \t]+/g, " "); // unfold
  v = v.replace(/[ \t]+/g, " "); // collapse WSP runs
  v = v.replace(/^[ \t]+|[ \t]+$/g, ""); // strip leading/trailing WSP
  return n + ":" + v + "\r\n";
}

/**
 * Build the exact signed-header bytes for a given DKIM signature:
 *  - each header named in h=, in order, matched to the first unused header of
 *    that name in file order, relaxed-canonicalized
 *  - then the DKIM-Signature header itself, relaxed-canonicalized with the b=
 *    tag value emptied, and with NO trailing CRLF.
 */
function buildSignedHeaders(headers: RawHeader[], sig: DkimSig): string {
  const usedIdx = new Set<number>();
  let out = "";

  for (const hName of sig.hList) {
    const lower = hName.toLowerCase();
    let matchIdx = -1;
    for (let i = 0; i < headers.length; i++) {
      if (usedIdx.has(i)) continue;
      if (headers[i].name.toLowerCase() === lower) {
        matchIdx = i;
        break;
      }
    }
    if (matchIdx === -1) {
      // Header listed in h= but not present: RFC says treat as empty value.
      out += relaxedHeader(hName, "");
      continue;
    }
    usedIdx.add(matchIdx);
    out += relaxedHeader(headers[matchIdx].name, headers[matchIdx].value);
  }

  // Append the DKIM-Signature header itself with b= emptied, no trailing CRLF.
  const emptiedValue = sig.header.value.replace(/\bb=[^;]*/, "b=");
  const dkimLine = relaxedHeader(sig.header.name, emptiedValue);
  out += dkimLine.replace(/\r\n$/, "");

  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  // Strip any whitespace, pad '=' to a multiple of 4, then decode with atob.
  let s = b64.replace(/[\s]+/g, "");
  while (s.length % 4 !== 0) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function extractFrom(headers: RawHeader[]): string {
  for (const h of headers) {
    if (h.name.toLowerCase() === "from") {
      return h.value.replace(/\r?\n[ \t]+/g, " ").trim();
    }
  }
  return "";
}

/**
 * Parse an .eml file and produce the exact (signedHeaders, signature) the
 * on-chain RealEmailVerifier expects.
 *
 * When multiple DKIM-Signature headers are present, prefer the one whose
 * d= is amazonses.com (the live-keyed one for btl.gov.il); otherwise use the
 * first one.
 */
export function parseEml(raw: string | Uint8Array): ParsedEmail {
  const text = toText(raw);
  const headerBlock = splitHeaders(text);
  const headers = parseHeaders(headerBlock);
  const sigs = findDkimSignatures(headers);

  if (sigs.length === 0) {
    throw new Error("No DKIM-Signature header found in email");
  }

  const chosen =
    sigs.find((s) => s.domain.toLowerCase() === "amazonses.com") ?? sigs[0];

  if (!chosen.bValue) {
    throw new Error("DKIM-Signature has no b= (signature) value");
  }

  const signedStr = buildSignedHeaders(headers, chosen);
  const signedBytes = encoder.encode(signedStr);
  const signatureBytes = base64ToBytes(chosen.bValue);

  return {
    signedHeaders: bytesToHex(signedBytes),
    signature: bytesToHex(signatureBytes),
    domain: chosen.domain,
    selector: chosen.selector,
    from: extractFrom(headers),
  };
}

/** Latin1 substring → raw bytes (each char is one byte, 0–255). */
function latin1Bytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/**
 * Parse a conversion-receipt .eml: everything parseEml returns, plus the raw
 * message body (the bytes after the first blank line). The on-chain verifier
 * applies DKIM "simple" body canonicalization and checks SHA-256/base64 against
 * the signed bh=, so the body must be passed through unmodified.
 */
export function parseReceiptEml(raw: string | Uint8Array): ParsedReceipt {
  const base = parseEml(raw);
  const text = toText(raw);
  const crlf = text.indexOf("\r\n\r\n");
  const lf = text.indexOf("\n\n");
  let idx = -1;
  let sep = 0;
  if (crlf !== -1 && (lf === -1 || crlf <= lf)) {
    idx = crlf;
    sep = 4;
  } else if (lf !== -1) {
    idx = lf;
    sep = 2;
  }
  const bodyStr = idx === -1 ? "" : text.slice(idx + sep);
  return { ...base, body: bytesToHex(latin1Bytes(bodyStr)) };
}
