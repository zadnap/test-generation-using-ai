import * as Kafka from 'kafkajs';
import { describe, expect, it, vi } from 'vitest';
import { KafkaReplyPartitionAssigner } from '../../../../packages/microservices/helpers/kafka-reply-partition-assigner.js';

/**
 * C3 decisions of KafkaReplyPartitionAssigner:
 * assign
 * D1: !previousAssignment[memberId] && Object.keys(member.previousAssignment).length > 0
 *     1c1: member not seen yet          -> T / F (duplicate memberId in the group)
 *     1c2: non-empty previous assignment -> T / F
 * D2: !assignment[assignee]             -> T (first sight) / F (already created)
 * D3: !assignment[assignee][topic]      -> T / F
 * D4: previousAssignment[assignee] && !isUndefined(previousAssignment[assignee][topic])
 *     4c1: member has a previous assignment -> T / F
 *     4c2: that topic is present            -> T / F
 * D5: topicsPartitionsIndex !== -1 (previous partition still free)  -> T / F
 * D6: assignment[assignee][topic].length === 0                      -> T / F
 * D7: topicsPartitionsIndex !== -1 (free partition left for the topic) -> T / F
 * (the balancing step and MemberAssignment.encode are straight-line)
 * protocol
 * D8: JSON.stringify of getPreviousAssignment() - no branch, only encoding
 * decodeMember
 * D9: MemberMetadata.decode throws (catch) -> T / F
 * decodePreviousAssignment
 * D10: !rawUserData                                        -> T / F
 * D11: JSON.parse throws (catch)                           -> T / F
 * D12: previousAssignment && typeof === 'object' && !Array.isArray(...)
 *      12c1: truthy previousAssignment    -> T / F
 *      12c2: typeof object                -> T / F
 *      12c3: not an array                 -> T / F
 *
 * No infeasible paths: 12c2 false is covered with a string, 12c2 true/12c3 true
 * with an array, and D1 c1(F) by a group that lists the same memberId twice
 * (the only way previousAssignment[memberId] is already set within one call).
 */

type Partitions = Array<{ partitionId: number }>;

function makeAssigner(
  metadata: Record<string, Partitions>,
  consumerAssignments: Record<string, unknown> = {},
) {
  const cluster = {
    findTopicPartitionMetadata: vi.fn((topic: string) => metadata[topic] ?? []),
  };
  const clientKafka = {
    getConsumerAssignments: vi.fn(() => consumerAssignments),
  };
  const assigner = new KafkaReplyPartitionAssigner(clientKafka as any, {
    cluster,
  });
  return { assigner, cluster, clientKafka };
}

function member(memberId: string, previousAssignment?: Record<string, number>) {
  return {
    memberId,
    memberMetadata: Kafka.AssignerProtocol.MemberMetadata.encode({
      version: 1,
      topics: ['ignored-by-assign'],
      userData: Buffer.from(
        JSON.stringify({ previousAssignment: previousAssignment ?? {} }),
      ),
    }),
  };
}

function decodeAssignment(
  result: Array<{ memberId: string; memberAssignment: Buffer }>,
) {
  const decoded: Record<string, Record<string, number[]>> = {};
  for (const { memberId, memberAssignment } of result) {
    decoded[memberId] = (
      Kafka.AssignerProtocol.MemberAssignment.decode(memberAssignment) as any
    ).assignment;
  }
  return decoded;
}

describe('KafkaReplyPartitionAssigner.assign', () => {
  // D1 c1(T) c2(T), D4 c1(T) c2(T), D5(T)
  it('D1 c2(T) D4 c2(T) D5(T) - keeps the previous partition when it is still free', async () => {
    const { assigner } = makeAssigner({
      t: [
        { partitionId: 0 },
        { partitionId: 1 },
        { partitionId: 2 },
        { partitionId: 3 },
      ],
    });
    const result = await assigner.assign({
      members: [member('m1', { t: 2 }), member('m2', { t: 0 })],
      topics: ['t'],
    });

    expect(decodeAssignment(result)).toEqual({
      m1: { t: [2, 1] },
      m2: { t: [0, 3] },
    });
  });

  // D4 c2(T), D5(F), D7(T) - a stale partition falls back to a free one
  it('D5(F) D7(T) - a previous partition that no longer exists falls back to a free partition', async () => {
    const { assigner } = makeAssigner({
      t: [{ partitionId: 0 }, { partitionId: 1 }, { partitionId: 2 }],
    });
    const result = await assigner.assign({
      members: [member('m1', { t: 9 })],
      topics: ['t'],
    });

    expect(decodeAssignment(result)).toEqual({ m1: { t: [0, 1, 2] } });
  });

  // D5(F) at the previous step, D6(T), D7(F) - nothing is left for the new member
  it('D7(F) - a member gets no partition when the topic has none left', async () => {
    const { assigner } = makeAssigner({ t: [{ partitionId: 0 }] });
    const result = await assigner.assign({
      members: [member('m1', { t: 0 }), member('m2', { t: 5 })],
      topics: ['t'],
    });

    expect(decodeAssignment(result)).toEqual({
      m1: { t: [0] },
      m2: { t: [] },
    });
  });

  // D1 c1(T) c2(F) (empty previous), D2(T) first sight, D3(T), D6(T), D6(F), balancing modulo
  it('balances the remaining partitions across members in memberId order', async () => {
    const { assigner } = makeAssigner({
      t: [
        { partitionId: 0 },
        { partitionId: 1 },
        { partitionId: 2 },
        { partitionId: 3 },
        { partitionId: 4 },
      ],
    });
    const result = await assigner.assign({
      members: [member('m-b'), member('m-a')],
      topics: ['t'],
    });

    expect(decodeAssignment(result)).toEqual({
      'm-a': { t: [0, 2, 4] },
      'm-b': { t: [1, 3] },
    });
    expect(Object.keys(decodeAssignment(result))).toEqual(['m-a', 'm-b']);
  });

  // D4 c1(T) c2(F) - previous assignment exists, but not for this topic
  it('D4 c2(F) - a topic missing from the previous assignment gets a fresh partition', async () => {
    const { assigner } = makeAssigner({
      a: [{ partitionId: 0 }, { partitionId: 1 }],
      b: [{ partitionId: 2 }, { partitionId: 3 }],
    });
    const result = await assigner.assign({
      members: [member('m1', { a: 1 })],
      topics: ['a', 'b'],
    });

    expect(decodeAssignment(result)).toEqual({
      m1: { a: [1, 0], b: [2, 3] },
    });
  });

  // D1 c1(F) - the only way the map already holds the member id: duplicate ids
  it('D1 c1(F) - a duplicated memberId keeps only the first previous assignment', async () => {
    const { assigner } = makeAssigner({
      t: [{ partitionId: 0 }, { partitionId: 1 }],
    });
    const result = await assigner.assign({
      members: [member('dup', { t: 0 }), member('dup', { t: 0 })],
      topics: ['t'],
    });

    // The duplicate id resolves to one assignment: the previous partition 0
    // plus the single leftover partition 1.
    expect(result).toHaveLength(1);
    expect(result[0].memberId).toBe('dup');
    expect(decodeAssignment(result)).toEqual({ dup: { t: [0, 1] } });
  });

  // D2(F) is exercised by the second loop iteration (assignment already created)
  it('D2(F) D3(F) - a second topic for an existing assignment reuses the same record', async () => {
    const { assigner } = makeAssigner({
      a: [{ partitionId: 0 }],
      b: [{ partitionId: 1 }],
    });
    const result = await assigner.assign({
      members: [member('m1', { a: 0, b: 1 })],
      topics: ['a', 'b'],
    });

    expect(decodeAssignment(result)).toEqual({ m1: { a: [0], b: [1] } });
  });

  it('queries the cluster metadata for every subscribed topic', async () => {
    const { assigner, cluster } = makeAssigner({
      a: [{ partitionId: 0 }],
      b: [{ partitionId: 1 }],
    });

    await assigner.assign({ members: [member('m1')], topics: ['a', 'b'] });

    expect(cluster.findTopicPartitionMetadata).toHaveBeenCalledWith('a');
    expect(cluster.findTopicPartitionMetadata).toHaveBeenCalledWith('b');
  });
});

describe('KafkaReplyPartitionAssigner.protocol', () => {
  it('encodes the previous assignment as userData on the member metadata', () => {
    const previous = { t: 2 };
    const { assigner, clientKafka } = makeAssigner({}, previous);
    const subscription = { topics: ['t'], userData: Buffer.alloc(0) as Buffer };

    const groupState = assigner.protocol(subscription);

    expect(groupState.name).toBe('NestReplyPartitionAssigner');
    expect(
      subscription.userData.equals(
        Buffer.from(JSON.stringify({ previousAssignment: previous })),
      ),
    ).toBe(true);
    const decoded = Kafka.AssignerProtocol.MemberMetadata.decode(
      groupState.metadata,
    ) as any;
    expect(decoded.topics).toEqual(['t']);
    expect(JSON.parse(decoded.userData.toString())).toEqual({
      previousAssignment: previous,
    });
    expect(clientKafka.getConsumerAssignments).toHaveBeenCalled();
  });

  it('encodes an empty previous assignment when the client has none', () => {
    const { assigner } = makeAssigner({}, {});
    const groupState = assigner.protocol({
      topics: ['a'],
      userData: Buffer.alloc(0),
    });
    const decoded = Kafka.AssignerProtocol.MemberMetadata.decode(
      groupState.metadata,
    ) as any;

    expect(JSON.parse(decoded.userData.toString())).toEqual({
      previousAssignment: {},
    });
  });
});

describe('KafkaReplyPartitionAssigner.getPreviousAssignment', () => {
  it('delegates to ClientKafka#getConsumerAssignments', () => {
    const assignments = { t: [1] };
    const { assigner, clientKafka } = makeAssigner({}, assignments);

    expect(assigner.getPreviousAssignment()).toBe(assignments);
    expect(clientKafka.getConsumerAssignments).toHaveBeenCalledOnce();
  });
});

describe('KafkaReplyPartitionAssigner.decodeMember', () => {
  // D9 F, D10 F, D11 F, D12 all(T)
  it('D9(F) - decodes the previous assignment from valid member metadata', () => {
    const { assigner } = makeAssigner({});

    const decoded = assigner.decodeMember(member('m1', { t: 3 }));

    expect(decoded).toEqual({
      memberId: 'm1',
      previousAssignment: { t: 3 },
    });
  });

  // D9 T
  it('D9(T) - undecodable member metadata degrades to an empty previous assignment', () => {
    const { assigner } = makeAssigner({});

    const decoded = assigner.decodeMember({
      memberId: 'm1',
      memberMetadata: 'garbage' as any,
    });

    expect(decoded).toEqual({ memberId: 'm1', previousAssignment: {} });
  });

  // D10 T - empty userData buffer
  it('D10(T) - empty userData decodes to an empty previous assignment', () => {
    const { assigner } = makeAssigner({});
    const encoded = Kafka.AssignerProtocol.MemberMetadata.encode({
      version: 1,
      topics: ['t'],
      userData: Buffer.alloc(0),
    });

    expect(
      assigner.decodeMember({ memberId: 'm1', memberMetadata: encoded }),
    ).toEqual({ memberId: 'm1', previousAssignment: {} });
  });

  // D11 T, D12 c1(F)
  it.each([
    ['D11(T) - malformed JSON', 'not json', {}],
    ['D11(F) D12 c1(F) - no previousAssignment key', '{}', {}],
    ['D12 c1(F) - null previousAssignment', '{"previousAssignment":null}', {}],
    ['D12 c2(F) - string previousAssignment', '{"previousAssignment":"x"}', {}],
    [
      'D12 c2(T) c3(F) - array previousAssignment',
      '{"previousAssignment":[1,2]}',
      {},
    ],
    ['D11(F) D12 c1(F) - array root', '[]', {}],
    ['D12 c1(F) - number root', '42', {}],
    ['D12 c1(F) - null root', 'null', {}],
    [
      'D12 all(T) - object previousAssignment',
      '{"previousAssignment":{"a":1,"b":0}}',
      { a: 1, b: 0 },
    ],
  ])('%s', (_title, rawUserData, expected) => {
    const { assigner } = makeAssigner({});
    const encoded = Kafka.AssignerProtocol.MemberMetadata.encode({
      version: 1,
      topics: ['t'],
      userData: Buffer.from(rawUserData),
    });

    expect(
      assigner.decodeMember({ memberId: 'm1', memberMetadata: encoded }),
    ).toEqual({ memberId: 'm1', previousAssignment: expected });
  });

  // D12 c1(T) c2(T) c3(T) with an empty object record
  it('D12(T) - an empty object is a valid (but empty) previous assignment', () => {
    const { assigner } = makeAssigner({});
    const encoded = Kafka.AssignerProtocol.MemberMetadata.encode({
      version: 1,
      topics: ['t'],
      userData: Buffer.from('{"previousAssignment":{}}'),
    });

    expect(
      assigner.decodeMember({ memberId: 'm1', memberMetadata: encoded }),
    ).toEqual({ memberId: 'm1', previousAssignment: {} });
  });
});
