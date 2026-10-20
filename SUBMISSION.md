# Contribution type

Builder → Intelligent Contracts

## Title

SemanticFanoutBuffer — Credit-Controlled Semantic Multicast

## Notes / Description (963/1000)

SemanticFanoutBuffer is a reusable GenLayer multicast primitive. Members sign immutable subscription filters. Leader and validators independently fetch full commit-pinned documents, verify their SHA-256 and interpret every filter. Exact evidence and YES/NO/UNKNOWN-vector agreement determines admission. One packet occupies one shared slot but reserves a credit for every matched recipient. Partial ACK returns only that subscriber's credit; expiry releases remaining credits. Channel, root, sender and generation checks prevent cross-channel or stale ACKs. Live StudioNet proofs cover two-recipient fanout, partial ACK, recipient backpressure despite free capacity, maintenance-only progress while another subscriber is busy, drained slots, generation reuse, bad-hash hold, public expiry and five rejected attacks. This routes authored documents, not real-world service proof. 37 local tests plus 13 SDK checks pass. No funds, graph-head updates or certificates.

## Evidence URLs

- https://github.com/Starling-spell/semantic-fanout-buffer
- https://github.com/Starling-spell/semantic-fanout-buffer/blob/main/contracts/SemanticFanoutBuffer.py
- https://github.com/Starling-spell/semantic-fanout-buffer/blob/main/README.md
- https://github.com/Starling-spell/semantic-fanout-buffer/blob/main/LIVE_PROOFS.md
- https://explorer-studio.genlayer.com/address/0xf2601f20566e0e8Fd26f2f4Bdd0a2F18d94d23E9
- https://explorer-studio.genlayer.com/tx/0x1bea75df40fa87a32bbbb877d535379b1d372defd66a614013a36fafdfb4bef3
- https://explorer-studio.genlayer.com/tx/0xb41298d676cb60da0d4fd55a7d494105a081d59afd628614fb5bfb83f3949d59
- https://explorer-studio.genlayer.com/tx/0x5ee6d1e486374805ee3bb8a3ed0cff585a4e872178565390dd247a14725cdcbf
- https://explorer-studio.genlayer.com/tx/0xab42d59b25d366b5e7a78107d054a06f25f4f96e7ecea01947c1eccb02d11125
- https://explorer-studio.genlayer.com/tx/0xf4b5c44aff7b06a78d6c502b63f2af0b294377f070d8a90703bf31e87cc6c20d
- https://explorer-studio.genlayer.com/tx/0x5fec7ef1b35b39dd7d347a018d7e5161c7f51a123f720ea4f0da1d2cfcb41205
- https://explorer-studio.genlayer.com/tx/0x095d6e7de0b1970fe35c3a5724cf907ae580bbe66068bfd70f5b28752deba423
- https://explorer-studio.genlayer.com/tx/0xd5b4720b3cac73e476c0f1a0455f68793fb556ab431c9add98b7dc4b1f5acf93
- https://explorer-studio.genlayer.com/tx/0x749a9f4eea70004995d9939c1044d4d2fb5196209d51def5096ca7531f90705f

## Limitations

Experimental test-network deployment. Fictional document routing, not proof of actual service delivery or processing. Five live negative transactions are expected rejected attacks, not successful deliveries. UNKNOWN and disagreement handling are tested locally, not claimed as live distributed proofs. Established multicast/credit concepts; distinct from the previous owner-controlled graph workflow, not a claim of universal novelty.
