// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {Community, Direction, EmailProof, SourceCategory} from "../src/Types.sol";
import {IncentiveRegistry} from "../src/IncentiveRegistry.sol";
import {IGroth16Verifier} from "../src/interfaces/IGroth16Verifier.sol";
import {MockUSD} from "../src/mocks/MockUSD.sol";

/// @notice Shared harness: full system deployed via the real Deploy script, DKIM
///         keys and blueprint patterns pre-registered, plus helpers to fabricate
///         proofs (the MockGroth16Verifier accepts them; every contract-level check
///         stays real) and to enroll members / mint / propose.
///
///         The test contract itself is `admin` (owner of everything), so admin ops
///         need no pranking. `guardian` is a separate address.
abstract contract BaseTest is Test {
    Deploy.Deployment internal d;

    address internal guardian = makeAddr("guardian");

    // -- canonical domains (hash of lowercase domain string)
    bytes32 internal constant GOV_A = keccak256("taxes.gov-a.example");
    bytes32 internal constant GOV_B = keccak256("id.gov-b.example");
    bytes32 internal constant NEWS_A1 = keccak256("alerts.nation-a-news.example");
    bytes32 internal constant NEWS_A2 = keccak256("daily.nation-a-press.example");
    bytes32 internal constant NEWS_B1 = keccak256("newsletter.nation-b-news.example");
    bytes32 internal constant NEWS_B2 = keccak256("wire.nation-b-agency.example");
    bytes32 internal constant NEWS_I1 = keccak256("newsletters.intl-wire.example");
    bytes32 internal constant NEWS_I2 = keccak256("breaking.global-press.example");
    bytes32 internal constant NEWS_I3 = keccak256("digest.world-report.example");

    // -- blueprint pattern commitments
    bytes32 internal constant CITIZENSHIP_PATTERN = keccak256("p2peace/citizenship-v1");
    bytes32 internal constant NEWS_PATTERN = keccak256("p2peace/news-event-v1:demo-keywords");

    // -- one DKIM key hash per domain (rotation tests can add more)
    function dkimKeyOf(bytes32 domainHash) internal pure returns (bytes32) {
        return keccak256(abi.encode("dkim-key", domainHash));
    }

    /// @dev Faucet for the test reserve (the test deployment always uses MockUSD).
    function mintUsd(address to, uint256 amount) internal {
        MockUSD(address(d.usd)).mint(to, amount);
    }

    function setUp() public virtual {
        Deploy deployer = new Deploy();
        d = deployer.deploy(address(this), guardian, address(deployer));

        // Register DKIM keys for every domain used in tests.
        bytes32[9] memory domains =
            [GOV_A, GOV_B, NEWS_A1, NEWS_A2, NEWS_B1, NEWS_B2, NEWS_I1, NEWS_I2, NEWS_I3];
        for (uint256 i = 0; i < domains.length; i++) {
            d.dkim.setKey(domains[i], dkimKeyOf(domains[i]), 0, 0);
        }

        // Route both blueprints to the mock Groth16 verifier and allowlist them.
        d.verifier.setVerifier(CITIZENSHIP_PATTERN, IGroth16Verifier(address(d.groth16)));
        d.verifier.setVerifier(NEWS_PATTERN, IGroth16Verifier(address(d.groth16)));
        d.identity.setCitizenshipPattern(CITIZENSHIP_PATTERN, true);
        d.identity.setDomain(GOV_A, Community.A);
        d.identity.setDomain(GOV_B, Community.B);
    }

    // ------------------------------------------------------------- proof helpers

    function mkProof(bytes32 domainHash, bytes32 patternHash, bytes32 nullifier, uint64 emailTs)
        internal
        pure
        returns (EmailProof memory p)
    {
        p.dkimPubkeyHash = dkimKeyOf(domainHash);
        p.domainHash = domainHash;
        p.nullifier = nullifier;
        p.patternHash = patternHash;
        p.emailTimestamp = emailTs;
        // p.proof stays zeroed - the mock verifier ignores it.
    }

    /// @dev Identity nullifier for a member seed (stands in for
    ///      Poseidon(recipientAddress, salt)).
    function idNullifier(string memory seed) internal pure returns (bytes32) {
        return keccak256(abi.encode("id-nullifier", seed));
    }

    /// @dev Per-email nullifier (stands in for Poseidon(dkimSignature)).
    function emailNullifier(string memory seed) internal pure returns (bytes32) {
        return keccak256(abi.encode("email-nullifier", seed));
    }

    // ------------------------------------------------------------ member helpers

    /// @notice Enroll `wallet` in `community` with a fresh proof dated `now`.
    function registerMember(address wallet, Community community, string memory seed) internal {
        bytes32 domain = community == Community.A ? GOV_A : GOV_B;
        EmailProof memory p =
            mkProof(domain, CITIZENSHIP_PATTERN, idNullifier(seed), uint64(block.timestamp));
        d.identity.register(p, wallet);
    }

    /// @notice Enroll and fund a member, and mint `usdAmount` of their community
    ///         token (so 10% lands in their pool as corpus).
    function registerAndMint(
        address wallet,
        Community community,
        string memory seed,
        uint256 usdAmount
    ) internal {
        registerMember(wallet, community, seed);
        mintUsd(wallet, usdAmount);
        vm.startPrank(wallet);
        d.usd.approve(community == Community.A ? address(d.minterA) : address(d.minterB), usdAmount);
        (community == Community.A ? d.minterA : d.minterB).mintCitizen(usdAmount);
        vm.stopPrank();
    }

    // --------------------------------------------------------- incentive helpers

    /// @notice Standard demo incentive: all nine news sources, thresholds 1/1/2,
    ///         7-day window, 5% redistribution, 3 triggers max, 7-day cooldown.
    function defaultProposal(Direction direction)
        internal
        pure
        returns (IncentiveRegistry.ProposalInput memory input)
    {
        bytes32[] memory sourceDomains = new bytes32[](7);
        SourceCategory[] memory categories = new SourceCategory[](7);
        sourceDomains[0] = NEWS_A1;
        categories[0] = SourceCategory.CommunityA;
        sourceDomains[1] = NEWS_A2;
        categories[1] = SourceCategory.CommunityA;
        sourceDomains[2] = NEWS_B1;
        categories[2] = SourceCategory.CommunityB;
        sourceDomains[3] = NEWS_B2;
        categories[3] = SourceCategory.CommunityB;
        sourceDomains[4] = NEWS_I1;
        categories[4] = SourceCategory.International;
        sourceDomains[5] = NEWS_I2;
        categories[5] = SourceCategory.International;
        sourceDomains[6] = NEWS_I3;
        categories[6] = SourceCategory.International;

        input = IncentiveRegistry.ProposalInput({
            direction: direction,
            patternHash: NEWS_PATTERN,
            requiredA: 1,
            requiredB: 1,
            requiredIntl: 2,
            attestationWindow: 7 days,
            redistributionBps: 500,
            maxTriggers: 3,
            triggerCooldown: 7 days,
            sourceDomains: sourceDomains,
            categories: categories,
            descriptionURI: "ipfs://demo-incentive"
        });
    }

    /// @notice Drive a proposal through discussion + unanimous 1-vote-each approval
    ///         by `votersA` and `votersB` (already members holding >= 1e18 tokens),
    ///         then finalize. Reverts if it does not pass.
    function passProposal(uint256 id, address[] memory votersA, address[] memory votersB) internal {
        vm.warp(block.timestamp + d.incentives.discussionPeriod());
        for (uint256 i = 0; i < votersA.length; i++) {
            vm.startPrank(votersA[i]);
            d.tokenA.approve(address(d.incentives), 1e18);
            d.incentives.castVote(id, true, 1);
            vm.stopPrank();
        }
        for (uint256 i = 0; i < votersB.length; i++) {
            vm.startPrank(votersB[i]);
            d.tokenB.approve(address(d.incentives), 1e18);
            d.incentives.castVote(id, true, 1);
            vm.stopPrank();
        }
        vm.warp(block.timestamp + d.incentives.votingPeriod());
        d.incentives.finalize(id);
        require(d.incentives.isActive(id), "proposal did not pass");
    }

    /// @notice Attest a default incentive round to confirmation: one A source, one B
    ///         source, two international sources, all dated `emailTs`.
    function confirmDefaultEvent(uint256 incentiveId, uint64 emailTs, string memory eventSeed)
        internal
    {
        bytes32[4] memory sources = [NEWS_A1, NEWS_B1, NEWS_I1, NEWS_I2];
        for (uint256 i = 0; i < sources.length; i++) {
            d.attestation
                .attest(
                    incentiveId,
                    mkProof(
                        sources[i],
                        NEWS_PATTERN,
                        emailNullifier(string.concat(eventSeed, vm.toString(i))),
                        emailTs
                    )
                );
        }
    }
}
