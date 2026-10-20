import ast
import copy
import hashlib
import itertools
import json
from pathlib import Path
import re
from datetime import datetime
from types import SimpleNamespace
import pytest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'contracts/SemanticFanoutBuffer.py'
HELPERS = [n for n in ast.parse(SOURCE.read_text()).body if isinstance(n, (ast.Assign, ast.FunctionDef))]
COORD = 'Starling-spell/semantic-fanout-buffer/' + 'a' * 40 + '/examples/shared.txt'
F1 = 'The authored notice includes a definite planned-maintenance service-unavailability statement, even if fictional.'
F2 = 'The authored notice includes a definite increase of a subscription price, even if fictional.'


def namespace(gl=None):
    ns = {'json': json, 'hashlib': hashlib, 're': re, 'datetime': datetime, 'Address': lambda x: x.lower(), 'gl': gl}
    exec(compile(ast.Module(body=HELPERS, type_ignores=[]), str(SOURCE), 'exec'), ns)
    return ns


NS = namespace()


def raw(name='shared'):
    return (ROOT / 'examples' / (name + '.txt')).read_bytes()


def clock(vm, value):
    from genlayer import gl
    vm.warp(value)
    gl.message_raw['datetime'] = value


def setup(vm, deploy, alice, bob, ttl=1800, capacity=2, credit=1):
    c = deploy(str(SOURCE))
    from genlayer import Address
    a, b = str(Address(alice)), str(Address(bob))
    clock(vm, '2026-10-20T12:00:00Z')
    vm.sender = alice
    cid = c.open_channel('main', a + ',' + b, capacity, credit, ttl)
    c.subscribe(cid, F1)
    vm.sender = bob
    c.subscribe(cid, F2)
    c.activate(cid)
    return c, cid, a, b


def publish(vm, c, cid, signer, nonce, vector=None, fixture='shared', bad=False, http=200):
    vm.sender = signer
    vm.clear_mocks()
    vm.mock_web(r'.*raw\.githubusercontent\.com.*', {'response': {'status': http, 'headers': {}, 'body': raw(fixture)}, 'method': 'GET'})
    vm.mock_llm('.*SEMANTIC_FANOUT_V1.*', json.dumps({'labels': vector or ['YES', 'YES']}))
    coordinate = COORD.replace('shared.txt', fixture + '.txt')
    return c.publish(cid, nonce, coordinate, 'f' * 64 if bad else hashlib.sha256(raw(fixture)).hexdigest())


def test_multicast_partial_ack_backpressure_independent_progress_and_fence(direct_vm, direct_deploy, direct_alice, direct_bob):
    vm = direct_vm
    c, cid, a, b = setup(vm, direct_deploy, direct_alice, direct_bob)
    p1 = publish(vm, c, cid, direct_alice, 'both')
    packet1 = c.get_packet(p1)
    assert packet1['matched'] == [a, b]
    assert c.get_channel(cid)['slots'] == [p1, '']
    c.ack(cid, p1, 1, packet1['root'])
    assert c.get_delivery(p1)['pending'] == [b]
    p2 = publish(vm, c, cid, direct_alice, 'only-a', ['YES', 'NO'], 'maintenance')
    packet2 = c.get_packet(p2)
    assert packet2['status'] == 'PUBLISHED' and packet2['slot'] == 1
    p3 = publish(vm, c, cid, direct_alice, 'blocked')
    assert c.get_packet(p3)['status'] == 'BACKPRESSURED'
    assert c.get_channel(cid)['outstanding'] == {a: 1, b: 1}
    with vm.expect_revert('No delivery for this packet'):
        c.get_delivery(p3)
    c.ack(cid, p2, 1, packet2['root'])
    vm.sender = direct_bob
    c.ack(cid, p1, 1, packet1['root'])
    assert c.get_channel(cid)['outstanding'] == {a: 0, b: 0}
    assert c.get_delivery(p1)['status'] == 'DRAINED'
    p4 = publish(vm, c, cid, direct_alice, 'reuse')
    packet4 = c.get_packet(p4)
    assert packet4['slot'] == 0 and packet4['generation'] == 2
    with vm.expect_revert('Slot fence mismatch'):
        c.ack(cid, p1, 1, packet1['root'])
    assert c.get_packet(p1) == packet1
    assert c.mailbox(cid, b) == [{'packet': p4, 'generation': 2, 'root': packet4['root']}]


def test_ack_identity_root_and_cross_channel_binding(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    vm = direct_vm
    c, cid, a, b = setup(vm, direct_deploy, direct_alice, direct_bob)
    key = publish(vm, c, cid, direct_alice, 'ack')
    packet = c.get_packet(key)
    vm.sender = direct_charlie
    with vm.expect_revert('Not a pending subscriber'):
        c.ack(cid, key, 1, packet['root'])
    vm.sender = direct_alice
    with vm.expect_revert('Packet root mismatch'):
        c.ack(cid, key, 1, 'f' * 64)
    other = c.open_channel('other', a + ',' + b, 1, 1, 60)
    with vm.expect_revert('Delivery channel mismatch'):
        c.ack(other, key, 1, packet['root'])
    assert c.get_delivery(key)['pending'] == [a, b]
    c.ack(cid, key, 1, packet['root'])
    with vm.expect_revert('Not a pending subscriber'):
        c.ack(cid, key, 1, packet['root'])


def test_expiry_recovers_all_pending_credits_once_without_subscriber_cooperation(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    vm = direct_vm
    c, cid, a, b = setup(vm, direct_deploy, direct_alice, direct_bob, ttl=60)
    key = publish(vm, c, cid, direct_alice, 'expiry')
    packet = c.get_packet(key)
    clock(vm, '2026-10-20T12:01:00Z')
    with vm.expect_revert('Delivery not pending'):
        c.ack(cid, key, 1, packet['root'])
    assert c.mailbox(cid, a) == []
    vm.sender = direct_charlie
    c.sweep(cid)
    c.sweep(cid)
    room, delivery = c.get_channel(cid), c.get_delivery(key)
    assert room['outstanding'] == {a: 0, b: 0} and room['slots'] == ['', '']
    assert delivery['status'] == 'EXPIRED' and delivery['expired'] == [a, b]
    assert c.transition_count() == 1 and c.get_transition(0)['kind'] == 'EXPIRE'
    new = publish(vm, c, cid, direct_alice, 'after-expiry')
    assert c.get_packet(new)['generation'] == 2


@pytest.mark.parametrize('vector,status', [(['UNKNOWN', 'YES'], 'UNRESOLVED'), (['NO', 'NO'], 'NO_MATCH')])
def test_no_partial_delivery_on_uncertainty_or_no_match(direct_vm, direct_deploy, direct_alice, direct_bob, vector, status):
    c, cid, a, b = setup(direct_vm, direct_deploy, direct_alice, direct_bob)
    key = publish(direct_vm, c, cid, direct_alice, 'test', vector)
    assert c.get_packet(key)['status'] == status
    assert c.get_channel(cid)['outstanding'] == {a: 0, b: 0}


@pytest.mark.parametrize('bad,http', [(True, 200), (False, 404)])
def test_independent_acquisition_failure_never_allocates(direct_vm, direct_deploy, direct_alice, direct_bob, bad, http):
    c, cid, a, b = setup(direct_vm, direct_deploy, direct_alice, direct_bob)
    key = publish(direct_vm, c, cid, direct_alice, 'bad', bad=bad, http=http)
    assert c.get_packet(key)['status'] == 'HELD'
    assert c.get_packet(key)['report']['labels'] == []
    assert c.get_channel(cid)['slots'] == ['', '']
    with direct_vm.expect_revert('Packet nonce used'):
        c.publish(cid, 'bad', 'invalid', 'invalid')


def test_enrollment_self_authentication_immutable_filters_and_abort(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    vm = direct_vm
    c = direct_deploy(str(SOURCE))
    from genlayer import Address
    a, b = str(Address(direct_alice)), str(Address(direct_bob))
    clock(vm, '2026-10-20T12:00:00Z')
    vm.sender = direct_alice
    cid = c.open_channel('enroll', a + ',' + b, 2, 1, 60)
    vm.sender = direct_charlie
    with vm.expect_revert('Not a channel member'):
        c.subscribe(cid, F1)
    vm.sender = direct_alice
    c.subscribe(cid, F1)
    with vm.expect_revert('Subscription immutable'):
        c.subscribe(cid, F2)
    with vm.expect_revert('Subscriptions incomplete'):
        c.activate(cid)
    clock(vm, '2026-10-20T13:00:00Z')
    vm.sender = direct_charlie
    c.abort_unenrolled(cid)
    assert c.get_channel(cid)['status'] == 'ABORTED'


@pytest.mark.parametrize('value', [{'labels': []}, {'labels': ['YES']}, {'labels': ['YES', 'MAYBE']},
 {'labels': ['YES', 'NO'], 'confidence': 1}, {'labels': [True, 'NO']}, '{"labels":["YES","NO"],"labels":[]}'])
def test_malformed_semantic_vectors(value):
    with pytest.raises((ValueError, TypeError)):
        NS['labels'](value, 2)


@pytest.mark.parametrize('coord', ['https://localhost/x', COORD.replace('a' * 40, 'main'),
 COORD.replace('examples/shared', '../shared'), COORD.replace('.txt', '.json')])
def test_unsafe_sources(coord):
    with pytest.raises(ValueError):
        NS['source_spec'](coord, 'b' * 64)


def test_all_four_subscriber_decisions_and_credit_states():
    checked = 0
    members = ['a', 'b', 'c', 'd']
    for vector in itertools.product(['YES', 'NO', 'UNKNOWN'], repeat=4):
        for outstanding in itertools.product([0, 1], repeat=4):
            for slots in [['', ''], ['occupied', ''], ['one', 'two']]:
                room = {'config': {'members': members, 'credit': 1}, 'outstanding': dict(zip(members, outstanding)), 'slots': slots}
                status, matched, blocked = NS['disposition']({'source': {'status': 'OK'}, 'labels': vector}, room)
                expected_matches = [members[i] for i in range(4) if vector[i] == 'YES']
                if 'UNKNOWN' in vector:
                    assert status == 'UNRESOLVED' and matched == []
                elif not expected_matches:
                    assert status == 'NO_MATCH'
                else:
                    full = all(slots) or any(outstanding[members.index(a)] for a in expected_matches)
                    assert status == ('BACKPRESSURED' if full else 'PUBLISHED')
                    assert matched == expected_matches
                checked += 1
    assert checked == 3888


def test_actual_callback_refetches_and_independently_reasons():
    class Return:
        def __init__(self, data):
            self.calldata = data
    class UserError(Exception):
        pass
    counts = {'web': 0, 'llm': 0}
    def web(url):
        counts['web'] += 1
        return SimpleNamespace(status=200, body=raw())
    def llm(*args, **kwargs):
        counts['llm'] += 1
        return {'labels': ['YES', 'YES']}
    def run(leader, validator):
        report = leader()
        assert validator(Return(copy.deepcopy(report)))
        forged = copy.deepcopy(report)
        forged['labels'] = ['NO', 'NO']
        assert not validator(Return(forged))
        forged = copy.deepcopy(report)
        forged['binding']['channel'] = 'other'
        assert not validator(Return(forged))
        assert not validator(object())
        return report
    fake = SimpleNamespace(vm=SimpleNamespace(Return=Return, UserError=UserError, run_nondet_unsafe=run),
                           nondet=SimpleNamespace(web=SimpleNamespace(get=web), exec_prompt=llm))
    ns = namespace(fake)
    spec = ns['source_spec'](COORD, hashlib.sha256(raw()).hexdigest())
    result = ns['consensus_report']({'channel': 'right'}, spec, [F1, F2])
    assert result['labels'] == ['YES', 'YES']
    assert counts == {'web': 3, 'llm': 3}


def test_post_consensus_forgery_rejected():
    fake = SimpleNamespace(vm=SimpleNamespace(run_nondet_unsafe=lambda *a: {'binding': {'channel': 'wrong'}, 'source': {}, 'labels': []}))
    with pytest.raises(ValueError):
        namespace(fake)['consensus_report']({'channel': 'right'}, {}, [F1, F2])


@pytest.mark.parametrize('body,status', [(b'', 'SIZE_ERROR'), (b'a' * 4097, 'SIZE_ERROR'), (b'\xff', 'ENCODING_ERROR')])
def test_evidence_cannot_be_truncated_or_decoded_lossily(body, status):
    fake = SimpleNamespace(nondet=SimpleNamespace(web=SimpleNamespace(get=lambda url: SimpleNamespace(status=200, body=body))))
    ns = namespace(fake)
    spec = ns['source_spec'](COORD, 'b' * 64)
    row = ns['fetch_source'](spec)
    assert row['status'] == status and not ns['source_ok'](spec, row)


@pytest.mark.parametrize('mutation', [lambda r: r.update(body='altered'), lambda r: r.update(hash='f' * 64),
 lambda r: r.update(http=True), lambda r: r.update(status='HELD'), lambda r: r.update(url='https://localhost')])
def test_evidence_report_binding(mutation):
    body = raw()
    spec = NS['source_spec'](COORD, hashlib.sha256(body).hexdigest())
    row = {'url': spec['url'], 'http': 200, 'body': body.decode(), 'hash': spec['sha256'], 'status': 'OK'}
    mutation(row)
    with pytest.raises(ValueError):
        NS['source_ok'](spec, row)


def test_budget_exhaustion_does_not_strand_expired_credits(direct_vm, direct_deploy, direct_alice, direct_bob):
    vm = direct_vm
    c, cid, a, b = setup(vm, direct_deploy, direct_alice, direct_bob, ttl=60)
    publish(vm, c, cid, direct_alice, 'pending')
    for i in range(23):
        publish(vm, c, cid, direct_alice, 'none-' + str(i), ['NO', 'NO'], 'neither')
    with vm.expect_revert('Channel attempt limit'):
        publish(vm, c, cid, direct_alice, 'too-many')
    clock(vm, '2026-10-20T12:01:00Z')
    c.sweep(cid)
    assert c.get_channel(cid)['outstanding'] == {a: 0, b: 0}


def test_credit_snapshot_is_not_mutated_by_allocation(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, cid, a, b = setup(direct_vm, direct_deploy, direct_alice, direct_bob)
    key = publish(direct_vm, c, cid, direct_alice, 'snapshot')
    packet = c.get_packet(key)
    assert packet['credit_state']['outstanding'] == {a: 0, b: 0}
    assert packet['credit_state']['slots'] == ['', '']
    assert packet['report']['binding']['credit_state_root'] == NS['digest'](packet['credit_state'])
    assert c.get_channel(cid)['outstanding'] == {a: 1, b: 1}


def test_buffer_capacity_can_block_before_subscriber_credit_exhaustion(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, cid, a, b = setup(direct_vm, direct_deploy, direct_alice, direct_bob, capacity=1, credit=2)
    publish(direct_vm, c, cid, direct_alice, 'occupy')
    key = publish(direct_vm, c, cid, direct_alice, 'capacity-blocked')
    packet = c.get_packet(key)
    assert packet['status'] == 'BACKPRESSURED' and packet['blocked'] == []
    assert c.get_channel(cid)['outstanding'] == {a: 1, b: 1}


def test_outsider_cannot_spend_channel_attempt_budget(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, cid, a, b = setup(direct_vm, direct_deploy, direct_alice, direct_bob)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert('Publisher not enrolled'):
        c.publish(cid, 'unauthorized', COORD, 'f' * 64)
    assert c.get_channel(cid)['attempts'] == []
