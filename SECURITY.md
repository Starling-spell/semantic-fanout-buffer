# Security boundary

Experimental and unaudited. No production safety, availability guarantee, legal compliance, actual service delivery or real-world truth is established. This is a public-content broker prototype, not a private messaging system or monetary escrow.

Validators independently acquire and interpret complete pinned source bytes. Exact report agreement prevents one leader from supplying an unchecked match vector, but models can share semantic mistakes or prompt-injection weaknesses. A compromised publisher can publish misleading text; source integrity does not make it true. Filters explicitly concern authored content. Synthetic fixtures and the same operator's test signers are not independent real-world authorities or humans.

The trusted computing base includes the contract's credit and partition logic, GenVM storage/time semantics, source availability and GenLayer consensus. No outcome can safely assert external processing from ACK alone. Consumers should inspect exact roots, source bodies, predicates and status, and independently establish any external facts their use case needs.

Only listed members can subscribe/publish; enrollment is self-authenticated, predicates freeze before activation. No owner can forge another member's filter or ACK. Packet IDs bind deployment, channel, publisher and nonce; reports bind frozen config, exact source coordinates/commitment and the current credit snapshot. Delivery records store channel/packet root/slot/generation. Resolution checks these fields, not just a caller-supplied channel or token. Old generations, duplicate ACKs, foreign principals and wrong roots reject without changing credits.

Every pending member occupies exactly one credit per packet. One message has one shared physical slot. Partial ACKs do not release the physical slot until no recipients remain. Expiry returns only pending members' credits, marks their obligations EXPIRED and cannot double-release on later sweeps. ACK never operates at/after the deadline. A slow/crashed member can block matching publications until expiry, but cannot strand credits forever; unrelated matching sets can proceed while capacity permits.

An enrolled malicious publisher may consume the bounded 24-attempt budget or provoke backpressure. This is cooperative channel admission, not Sybil-resistant global fair scheduling, confidentiality or Byzantine reliable broadcast. Expiry deliberately permits message loss; public sources may disappear and immutable commitments do not ensure availability. Recovery requires someone to call sweep (or publish); no automatic background process is promised. Capacity is bounded but retained history grows with authenticated channel creations.

No token approvals, external write calls, money, delegate execution, arbitrary eval, privileged upgrade or mutable policy override. All source URLs are contract-constructed commit-pinned GitHub raw `.txt` paths; unsafe paths and oversized/lossy bodies fail closed. Creator/resource bounds limit each namespace, not all Sybil identities.

Publish a minimal reproducible security issue without credentials. Source fixes require an explicit new deployment; old packets must not be silently reinterpreted. Never store wallet secrets, private documents or personal data in public artifacts.
