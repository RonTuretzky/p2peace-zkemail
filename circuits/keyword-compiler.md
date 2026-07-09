# Keyword compiler: proposal boolean logic → zk-regex → `patternHash`

The original p2peace proposal lets incentive authors build keyword patterns in a UI:

```
(k1 OR k2 OR …) AND (k3 OR k4 OR …) AND …
```

Voters approve an **exact circuit**, not prose, so this boolean logic must compile
deterministically into a zk-regex artifact whose hash (`patternHash`) is committed in
the proposal and enforced by `EventAttestation`. This document is the compiler spec.
The worked example in §7 produces exactly the `kwGroup1..kwGroup4` regexes in
[`blueprints/news-event.json`](./blueprints/news-event.json).

## 1. Input grammar

The UI emits a normalized AST — conjunctive normal form only (this is all the original
UI could express, and CNF maps 1:1 onto zk-regex; arbitrary nesting is deliberately
rejected):

```
pattern   := group ("AND" group)+        # 1..MAX_GROUPS groups (MAX_GROUPS = 6)
group     := "(" phrase ("OR" phrase)* ")"   # 1..MAX_ALTS phrases (MAX_ALTS = 8)
phrase    := token (" " token)*          # 1..4 tokens
token     := 1..24 non-whitespace characters
```

JSON form produced by the UI (the compiler's canonical input):

```json
{ "version": 1,
  "groups": [ ["checkpoint removal", "military withdrawal", "IDF dismantles"],
              ["Jordan Valley", "West Bank"],
              ["removed", "dismantled", "withdrawn"],
              ["confirmed", "verified", "observed"] ] }
```

## 2. Compilation rules

**Rule G (groups → conjunction).** Each AND-group compiles to **one decomposed regex**
(one zk-regex matcher instance over the email body). zk-regex matchers expose a match
flag (match count ≥ 1); the news-event circuit constrains **every** group's flag to 1.
The conjunction is therefore the *set* of matchers — there is no OR across groups, only
inside them. No captures: all parts are `isPublic: false`; only the boolean matters.

**Rule O (phrases → alternation).** The phrases of a group become a top-level
alternation `p1|p2|…` in that group's single regex part. zk-regex supports alternation
natively (it compiles to an NFA product; cost grows roughly linearly in total
alternation bytes).

**Rule T (tokens → folded byte matchers).** Each character of a token compiles per §4
(case folding) and §5 (non-ASCII). Characters listed in §3 are escaped first.

**Rule S (separators).** A space between tokens in a phrase compiles to
`( |\t|\r\n)+` — one-or-more whitespace, tolerating hard line wraps inside a phrase.
Quoted-printable *soft* breaks (`=\r\n`) are already removed before matching by the
circuit's `removeSoftLinebreaks` stage, so they need no regex handling.

**Determinism.** Same input JSON ⇒ byte-identical output artifact. The compiler is a
pure function; no locale, no environment, sorted keys, `\n`-free canonical JSON (§6).

## 3. Escaping

Inside `regexDef`, these characters of a token are escaped with a backslash (zk-regex's
supported metacharacter set — it accepts a *subset* of standard regex syntax):

```
\ . + * ? ( ) [ ] | ^ $ -
```

Additionally: `"` and `\` are then JSON-escaped by serialization; literal CR/LF inside
tokens is rejected at the UI layer (tokens are non-whitespace by grammar). zk-regex has
**no** `\b`, no lookahead/lookbehind, no backreferences, no lazy quantifiers, no `{n,m}`
counted repetition — the compiler never emits them. See §8 for the word-boundary
consequence.

## 4. Case folding (ASCII)

zk-regex matches raw bytes and has no case-insensitivity flag. Each ASCII letter `x`
compiles to the two-byte class `[Xx]`:

```
"West Bank" → [Ww][Ee][Ss][Tt]( |\t|\r\n)+[Bb][Aa][Nn][Kk]
```

This is applied uniformly, including all-caps acronyms (`IDF` → `[Ii][Dd][Ff]`) —
headline style varies ("IDF", "Idf") and false-positive risk from folding is negligible
next to the recall loss from not folding. Digits and escaped punctuation pass through
unchanged. Cost: folding roughly doubles the DFA state count per letter; at typical
pattern sizes (≤ ~300 pattern bytes) this is noise next to SHA-256 of the body (§ README
7).

Only ASCII `A-Z/a-z` fold. Unicode case folding (e.g. Cyrillic, Greek, Latin-1
accents) is **not** performed — see §5.

## 5. Unicode: Hebrew / Arabic sources

News sources on both sides publish in Hebrew and Arabic. Honest constraints:

1. **Byte-level matching works.** zk-regex sees UTF-8 bytes; a Hebrew or Arabic keyword
   compiles to its literal UTF-8 byte sequence (e.g. `הוסר` → bytes
   `D7 94 D7 95 D7 A1 D7 A8`). No case folding is needed (neither script has case).
2. **Transfer encoding is the real problem.** DKIM signs the body **as transmitted**.
   Non-ASCII newsletter bodies are almost always `quoted-printable` or `base64`:
   - *Quoted-printable*: each non-ASCII byte appears as `=XX` hex triplets. The
     compiler therefore emits each non-ASCII keyword in **two alternation variants**:
     raw UTF-8 bytes (for `8bit`/`binary` parts) and QP form
     (`=D7=94=D7=95=D7=A1=D7=A8`), with QP hex letters folded `[0-9A-Fa-f]`-style per
     RFC 2045 (uppercase is canonical but not universal). Soft line breaks inside a QP
     sequence are already stripped by `removeSoftLinebreaks`.
   - *Base64 bodies cannot be regex-matched in v1.* `@zk-email/circuits` ships a
     `Base64Decode` helper, but decoding a multi-KB body in-circuit is expensive and is
     not a registry-blueprint feature; v1 requires attesters to use sources whose
     text/plain part is QP/8bit (the large newsletter senders all offer one). Flagged
     per-source during proposal review.
3. **Normalization.** The compiler normalizes keywords to **NFC** and matches only that
   form. Senders overwhelmingly emit NFC; NFD-emitting sources would silently miss.
4. **Arabic diacritics & variants.** Tashkeel (`ً ٌ ٍ َ ُ ِ ّ ْ`, U+064B–U+0652) are
   stripped from keywords and — because zk-regex cannot express "optional diacritic
   after every letter" affordably — patterns should use diacritic-free forms, which is
   standard for news copy. Alef variants (أ/إ/آ vs ا) and ta-marbuta/heh (ة/ه) are NOT
   auto-folded; authors must list variants as separate OR phrases. The UI warns.
5. **Directionality marks.** Invisible RTL/LTR marks (U+200E/U+200F, U+202A–U+202E)
   embedded mid-phrase by some CMSes will break byte-exact matching. The compiler
   cannot tolerate them cheaply; the pattern tester (§8) detects their presence in a
   source's archive and warns the author to anchor keywords on mark-free spans.
6. **Hebrew final forms** (ך ם ן ף ץ) are distinct code points, handled correctly by
   byte-literal matching as long as the keyword is spelled as it appears in copy.

## 6. Canonical artifact and `patternHash`

The compiler's output artifact is the ordered list of decomposed regexes:

```json
{ "compilerVersion": 1,
  "sourcePattern": { …normalized input JSON… },
  "decomposedRegexes": [
    { "name": "kwGroup1", "location": "body", "maxLength": 64,
      "parts": [ { "isPublic": false, "regexDef": "…" } ] },
    …one per AND-group, in input order…
  ] }
```

Canonical serialization: UTF-8, keys sorted lexicographically, no insignificant
whitespace. `artifactSha256 = sha256(canonicalBytes)`.

The artifact is embedded into a `p2peace/news-event-v1/incentive-<id>` blueprint
instance (the template's `fromDomain`/`dkimTimestamp` regexes + these body regexes) and
submitted to the registry, which compiles and versions it. Then:

```
patternHash = keccak256(utf8(blueprintSlug) ‖ "@" ‖ utf8(decimalVersion))
```

as defined in [README §5](./README.md#5-patternhash-pinning-the-circuit). The proposal
stores `patternHash` on-chain and pins `artifactSha256` (plus the verifying key's
`vk.json` hash) in its metadata URI, so the name→content link is independently
auditable even though the registry slug is not itself a content hash. Any deviation —
reordered groups, different folding, an extra space — yields a different artifact, a
different compiled circuit, a different verifying key, and a proof that
`ZKEmailVerifier` will not accept for the incentive's `patternHash`.

## 7. Worked example: checkpoint removal (incentive #42)

UI input (the checkpoint-removal example from the original proposal):

```
(checkpoint removal OR military withdrawal OR IDF dismantles)
AND (Jordan Valley OR West Bank)
AND (removed OR dismantled OR withdrawn)
AND (confirmed OR verified OR observed)
```

Normalized compiler input:

```json
{ "version": 1,
  "groups": [ ["checkpoint removal", "military withdrawal", "IDF dismantles"],
              ["Jordan Valley", "West Bank"],
              ["removed", "dismantled", "withdrawn"],
              ["confirmed", "verified", "observed"] ] }
```

Applying the rules — all tokens are ASCII (Rule T/§4: per-letter fold; no escapable
characters present), phrase-internal spaces become `( |\t|\r\n)+` (Rule S), phrases
join with `|` (Rule O), one regex per group (Rule G):

**kwGroup1** (`checkpoint removal | military withdrawal | IDF dismantles`):

```
[Cc][Hh][Ee][Cc][Kk][Pp][Oo][Ii][Nn][Tt]( |\t|\r\n)+[Rr][Ee][Mm][Oo][Vv][Aa][Ll]
|[Mm][Ii][Ll][Ii][Tt][Aa][Rr][Yy]( |\t|\r\n)+[Ww][Ii][Tt][Hh][Dd][Rr][Aa][Ww][Aa][Ll]
|[Ii][Dd][Ff]( |\t|\r\n)+[Dd][Ii][Ss][Mm][Aa][Nn][Tt][Ll][Ee][Ss]
```

**kwGroup2** (`Jordan Valley | West Bank`):

```
[Jj][Oo][Rr][Dd][Aa][Nn]( |\t|\r\n)+[Vv][Aa][Ll][Ll][Ee][Yy]
|[Ww][Ee][Ss][Tt]( |\t|\r\n)+[Bb][Aa][Nn][Kk]
```

**kwGroup3** (`removed | dismantled | withdrawn`):

```
[Rr][Ee][Mm][Oo][Vv][Ee][Dd]|[Dd][Ii][Ss][Mm][Aa][Nn][Tt][Ll][Ee][Dd]|[Ww][Ii][Tt][Hh][Dd][Rr][Aa][Ww][Nn]
```

**kwGroup4** (`confirmed | verified | observed`):

```
[Cc][Oo][Nn][Ff][Ii][Rr][Mm][Ee][Dd]|[Vv][Ee][Rr][Ii][Ff][Ii][Ee][Dd]|[Oo][Bb][Ss][Ee][Rr][Vv][Ee][Dd]
```

(Line breaks above are display-only; each regex is a single line in the artifact.
These are byte-identical to `decomposedRegexes[2..5]` in `blueprints/news-event.json`.)

The circuit instantiates four body matchers and constrains
`match1 ∧ match2 ∧ match3 ∧ match4`. A newsletter lead like *"IDF dismantles West Bank
checkpoint: barriers removed, withdrawal confirmed by observers"* matches all four
groups (g1: "IDF dismantles"; g2: "West Bank"; g3: "removed"; g4: "confirmed").
Contrast *"IDF dismantles West Bank checkpoint; removal confirmed"* — it **fails**
group 3 ("removal" does not contain "removed"): the conjunction deliberately demands
completed-action language, which is exactly the strictness the original proposal's
fourth group was for. Compiled, embedded, registered as
`p2peace/news-event-v1/incentive-42@1`:

```
patternHash = keccak256("p2peace/news-event-v1/incentive-42@1")
```

which is the value the incentive stores and every attestation proof must route through.

## 8. Semantics caveats & the pattern tester

- **No word boundaries.** Without `\b`, `[Ww]…withdrawn` also matches inside
  "overwithdrawn"; "West Bank" matches inside "Key West Bankruptcy". CNF with 3–4
  specific groups makes accidental full-conjunction matches rare, but authors must
  check, not assume.
- **Groups can match in different sentences** — the conjunction is per-email, not
  per-sentence. This is inherent to the design (and matches the original proposal's
  semantics); tighten groups rather than expecting proximity.
- **Recall risk beats precision risk.** A pattern that never matches real headline copy
  burns a proposal cycle. Newsletters carry headline/lead-grade language — test against
  it.
- **The pattern tester** (off-chain, in `app/`; the original's "keyword testing tool")
  runs the *compiled* artifact — same alternations, same folding, plus QP-variant
  expansion — as ordinary JS regexes over an exported `.mbox`/`.eml` archive, reporting
  per-group and full-conjunction hit rates and flagging §5 hazards (base64-only
  sources, RTL marks, NFD text). Because it consumes the canonical artifact, tester
  behavior and circuit behavior can only diverge in zk-regex compilation bugs, not in
  pattern semantics.
