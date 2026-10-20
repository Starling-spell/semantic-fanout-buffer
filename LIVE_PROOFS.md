# Live proof ledger

Experimental StudioNet deployment; chain 61999. Source SHA-256: `2cf5445c77ec5298c6adf6bffa2eab87938476ec19377a130ffe39958d6b6e73`.

[Matching contract](https://explorer-studio.genlayer.com/address/0xf2601f20566e0e8Fd26f2f4Bdd0a2F18d94d23E9) · [Source](https://github.com/Starling-spell/semantic-fanout-buffer/blob/main/contracts/SemanticFanoutBuffer.py) · [Machine-readable receipts and state](PROOFS.json).

Fixture revision: `94c28c47c03e48ff14526adc0ff368039e0a7d21`. The notices are explicitly fictional authored content, not evidence that a real outage or price change occurred. The three dedicated test signers belong to one operator; they are not three independent people or validators. ACK proves only a signed onchain acknowledgement.

## Proof matrix

| Requirement | Evidence | Observed result |
|---|---|---|
| Two recipients, one retained slot | shared-first; partial-ack checkpoint | PUBLISHED; A ACK returns only A credit; B remains pending |
| Recipient credit backpressure | credit-blocked | BACKPRESSURED by B despite another free slot |
| Nonmatching busy subscriber | ready-only | YES,NO; publishes to A while B is busy |
| All recipients release slot | ack-ready-A; ack-shared-B | Both original deliveries DRAINED; counters zero |
| Generation-fenced reuse | slot-reuse; stale-slot-ack | Slot 0 generation 2; old ACK rejects |
| Identity, channel and root binding | outsider-ack; cross-channel-ack; wrong-root-ack | Three expected ERROR / MAJORITY_AGREE receipts |
| Replay protection | publisher-replay | Expected ERROR; immutable nonce retained |
| Contract-side source commitment | bad-source | Full fetched body hash mismatch; HELD; no delivery |
| Uncooperative recipient recovery | expire-me; public-expiry-sweep | EXPIRED; credits zero; outsider trigger |
| No double expiry release | idempotent-expiry-sweep | SUCCESS; still zero credits; one EXPIRE event |
| UNKNOWN, malformed report and callback disagreement | Local tests only | Fail closed; not claimed as live distributed disagreement |
| Source and accounting equality | verify-live.mjs | Actual deployed source, all packet roots, partitions, generations and credit conservation |

## Immutable packet roots

| Publication | Outcome | Semantic vector | Slot / generation | Root |
|---|---|---|---|---|
| shared-first | PUBLISHED | YES, YES | 0 / 1 | `2356f1c2fc3a6258f68a6ac9a2c39999ae2a0872682bff16cc6b97a65b6ba748` |
| credit-blocked | BACKPRESSURED | YES, YES | -1 / 0 | `3f86dbf18c42c23fe4eca5191ec2efa81ba029325121711781b741a57b7b514c` |
| ready-only | PUBLISHED | YES, NO | 1 / 1 | `0ac35749a0640dd93fa45f9617948a56b742ac7d4816e6e33d96e52d4cd97385` |
| slot-reuse | PUBLISHED | YES, YES | 0 / 2 | `9369f833e19119755c3b251eba5aa87a4f4226b83fc68235730bc4c5955dfacc` |
| bad-source | HELD | no model vector | -1 / 0 | `062a95a9f2bdb37835dc660d652fdca0f616f0e9f35999acc907c47283b95995` |
| expire-me | PUBLISHED | YES, NO | 0 / 1 | `4239ea5234a5ae36899f51ed0faba8d7f2d25d539dc6fade7664dfc5e7d06b27` |

## Finalized transactions

FINALIZED alone is insufficient. Every listed receipt was checked for execution, MAJORITY_AGREE and actual state. Expected ERROR transactions are attack rejection evidence, not successful publications.

| Step | Final execution / consensus | Explorer |
|---|---|---|
| deploy | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x094464f49214bc55c6786f07805ab6982ec42c282a681508f31a8cb08df26216) |
| open-main | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x9be8dfd868824bc4c2cb0194d1f49dba1e1bd3bf308ff15edbd5ebfaf9bc776c) |
| subscribe-main-A | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x9db8a44c3f4908915b01d083d78651367f870ed8e9c26309ef4d28579a237be5) |
| subscribe-main-B | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x1584ae80ea3f40a33b79c955359fc88582ccc4d0c04acf09f7120174c6ab4516) |
| activate-main | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x579247da15d7e277c4e1448ed9c57552d45e95522d4364503759554ec9bfab2d) |
| open-expiry | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x9821be1f562d5678aca32827856302f4ac5d75842dbb1a69dccc068957d3deae) |
| subscribe-expiry-A | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0xe364c49b2eb690f86a373f770830226831f92c129fdb74a23939e0810f3ae3b1) |
| subscribe-expiry-B | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x40bb6faad01218005231117aad35e87ccf7fbdfeaac5525a6bb9d5e1c5c5bb61) |
| activate-expiry | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x95b21b4d36f3bc8d191851adeb5222f95a40edd0871df3a9d3068868404eef57) |
| shared-first | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x1bea75df40fa87a32bbbb877d535379b1d372defd66a614013a36fafdfb4bef3) |
| ack-shared-A | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0xb41298d676cb60da0d4fd55a7d494105a081d59afd628614fb5bfb83f3949d59) |
| credit-blocked | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x5ee6d1e486374805ee3bb8a3ed0cff585a4e872178565390dd247a14725cdcbf) |
| ready-only | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0xab42d59b25d366b5e7a78107d054a06f25f4f96e7ecea01947c1eccb02d11125) |
| ack-ready-A | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x48cf9ac2099d4a7527c8ffadcd011a6e1b98747d85b83673576b17d09816a39e) |
| ack-shared-B | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x4cd87824297e62b2b8d9bc791208cc1880b3d24b71f44153213ebe3a1b03f67b) |
| slot-reuse | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0xf4b5c44aff7b06a78d6c502b63f2af0b294377f070d8a90703bf31e87cc6c20d) |
| outsider-ack | ERROR; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0xe3f590fe60308da0bf39a480fcd4ba1524b1d06e874f558072dc3d649cbb6e09) |
| cross-channel-ack | ERROR; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x5fec7ef1b35b39dd7d347a018d7e5161c7f51a123f720ea4f0da1d2cfcb41205) |
| wrong-root-ack | ERROR; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0xbc81de2e3311d483173743b305d2f3be6e714339dca5e9bf72ba5d111cc59518) |
| stale-slot-ack | ERROR; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x095d6e7de0b1970fe35c3a5724cf907ae580bbe66068bfd70f5b28752deba423) |
| publisher-replay | ERROR; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x49f8f62081601126ed302f827053c53cf38defb86d65ffea2fc7de2614d49395) |
| bad-source | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0xd5b4720b3cac73e476c0f1a0455f68793fb556ab431c9add98b7dc4b1f5acf93) |
| expire-me | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x26ccdd1e05750f25c1e6d9695e7ae1a298c133d2e0cdb2bf20e0838c5697a5aa) |
| public-expiry-sweep | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x749a9f4eea70004995d9939c1044d4d2fb5196209d51def5096ca7531f90705f) |
| idempotent-expiry-sweep | SUCCESS; MAJORITY_AGREE | [transaction](https://explorer-studio.genlayer.com/tx/0x67e2a685e0793ff1d30bc32d8acaa1d8f11fe9d939d80d2c3bf283ec5ef809be) |

## Reproduce verification

`node scripts/verify-live.mjs` is read-only. It rechecks all finalized receipts, actual deployed source, immutable roots, per-recipient delivery partitions, credit conservation, slot generations and append-only ACK/expiry events. Later legitimate writes can change mutable delivery state; this demo snapshot is the recorded checkpoint, not a perpetual-state assertion.

Local validation: 33 Python tests, 4 independent JavaScript tests, 13 SDK calldata roundtrips; GenVM lint passes with a concrete pinned runner. Direct-mode and callback tests are not distributed consensus tests. No live UNKNOWN or disagreement outcome is claimed. Model validators can share biases; exact agreement is not factual truth. No production audit or global novelty claim.
