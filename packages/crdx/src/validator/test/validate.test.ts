/* eslint-disable @typescript-eslint/ban-ts-comment */
import { asymmetric } from '@localfirst/crypto'
import { buildGraph } from '../../util/testing/graph.js'
import { TEST_GRAPH_KEYS as keys, setup } from '../../util/testing/setup.js'
import { describe, expect, test, vitest } from 'vitest'
import { hashEncryptedLink } from '../../graph/hashLink.js'
import { append, createGraph, getHead, getLink, getRoot } from '../../graph/index.js'
import { type Hash } from '../../util/index.js'
import { validate } from '../validate.js'
import '../../util/testing/expect/toBeValid'

const { setSystemTime } = vitest.useFakeTimers()

const { alice, eve } = setup('alice', 'eve')

describe('graphs', () => {
  describe('validation', () => {
    describe('valid graphs', () => {
      test(`new graph`, () => {
        const graph = createGraph({ user: alice, name: 'Spies Я Us', keys })
        expect(validate(graph)).toBeValid()
      })

      test(`new graph with one additional link`, () => {
        const graph = createGraph({ user: alice, name: 'Spies Я Us', keys })
        const newLink = { type: 'FOO', payload: { name: 'charlie' } }
        const newGraph = append({ graph, action: newLink, user: alice, keys })
        expect(validate(newGraph)).toBeValid()
      })
    })

    describe('invalid graphs', () => {
      const setupGraph = () => {
        const graph = buildGraph(`
                             ┌─ e ─ g ─┐
                   ┌─ c ─ d ─┤         ├─ o ─┐
            a ─ b ─┤         └─── f ───┤     ├─ n
                   ├──── h ──── i ─────┘     │
                   └───── j ─── k ── l ──────┘
      `)
        expect(validate(graph)).toBeValid()
        return graph
      }

      test('The ROOT link cannot have any predecessors ', () => {
        const graph = setupGraph()
        const rootLink = getRoot(graph)

        rootLink.body.prev = graph.head
        expect(validate(graph)).not.toBeValid()
      })

      test('The ROOT link has to be the link referenced by the graph `root` property', () => {
        const graph = setupGraph()
        graph.root = graph.head[0]
        expect(validate(graph)).not.toBeValid()
      })

      test('Non-ROOT links must have predecessors', () => {
        const graph = setupGraph()
        const nonRootLink = getHead(graph)[0]
        nonRootLink.body.prev = []
        expect(validate(graph)).not.toBeValid()
      })

      test('The link referenced by the graph `root` property must be a ROOT link', () => {
        const graph = setupGraph()
        const rootLink = getRoot(graph)
        // @ts-expect-error
        rootLink.body.type = 'FOO'
        rootLink.body.prev = graph.head
        expect(validate(graph)).not.toBeValid()
      })

      test(`Eve tampers with the root`, () => {
        const graph = setupGraph()

        // 🦹‍♀️ Eve tampers with the root
        const rootLink = getRoot(graph)
        rootLink.body.userId = eve.userId

        // 🦹‍♀️ She reencrypts the link with her private key
        graph.encryptedLinks[graph.root] = {
          encryptedBody: asymmetric.encryptBytes({
            secret: rootLink.body,
            recipientPublicKey: keys.encryption.publicKey,
            senderSecretKey: eve.keys.encryption.secretKey,
          }),
          recipientPublicKey: keys.encryption.publicKey,
          senderPublicKey: eve.keys.encryption.publicKey,
        }

        // 👩🏾 Alice is not fooled, because the root hash no longer matches the computed hash of the root link
        expect(validate(graph)).not.toBeValid()
      })

      test(`Eve tampers with the root and also changes the root hash`, () => {
        const graph = setupGraph()

        // 🦹‍♀️ Eve tampers with the root
        const rootLink = getRoot(graph)
        rootLink.body.user = eve

        const oldRootHash = graph.root

        // 🦹‍♀️ She reencrypts the link with her private key
        const encryptedBody = asymmetric.encryptBytes({
          secret: rootLink.body,
          recipientPublicKey: keys.encryption.publicKey,
          senderSecretKey: eve.keys.encryption.secretKey,
        })

        // 🦹‍♀️ She removes the old root
        delete graph.links[oldRootHash] // eslint-disable-line @typescript-eslint/no-dynamic-delete
        // these links would resurface when syncing later anyway, because other people still have them
        delete graph.encryptedLinks[oldRootHash] // eslint-disable-line @typescript-eslint/no-dynamic-delete

        // 🦹‍♀️ She generates a new root hash
        const newRootHash = hashEncryptedLink(encryptedBody)
        graph.root = newRootHash // this would also prevent syncing in the future, since two graphs with different roots can't sync

        // 🦹‍♀️  She adds the tampered root
        graph.encryptedLinks[newRootHash] = {
          encryptedBody,
          senderPublicKey: eve.keys.encryption.publicKey,
          recipientPublicKey: keys.encryption.publicKey,
        }
        graph.links[newRootHash] = rootLink

        // 👩🏾 Alice is not fooled, because the next link after the root now has the wrong hash
        expect(validate(graph)).not.toBeValid()
      })

      test(`Eve tampers with the head`, () => {
        const graph = setupGraph()

        // 🦹‍♀️ Eve tampers with the head
        const headHash = graph.head[0]
        const headLink = getLink(graph, headHash)
        headLink.body.userId = eve.userId

        // 🦹‍♀️ She reencrypts the link with her private key
        graph.encryptedLinks[headHash] = {
          encryptedBody: asymmetric.encryptBytes({
            secret: headLink.body,
            recipientPublicKey: keys.encryption.publicKey,
            senderSecretKey: eve.keys.encryption.secretKey,
          }),
          recipientPublicKey: keys.encryption.publicKey,
          senderPublicKey: eve.keys.encryption.publicKey,
        }

        // 👩🏾 Alice is not fooled, because the head hash no longer matches the computed hash of the head link
        expect(validate(graph)).not.toBeValid()
      })

      test(`Eve tampers with an arbitrary link`, () => {
        const graph = setupGraph()

        // 🦹‍♀️ Eve tampers with a link
        const linkHash = Object.keys(graph.links)[2] as Hash
        const link = getLink(graph, linkHash)

        link.body.payload = 'foo'

        // 🦹‍♀️ She reencrypts the link with her private key
        graph.encryptedLinks[linkHash] = {
          encryptedBody: asymmetric.encryptBytes({
            secret: link.body,
            recipientPublicKey: keys.encryption.publicKey,
            senderSecretKey: eve.keys.encryption.secretKey,
          }),
          recipientPublicKey: keys.encryption.publicKey,
          senderPublicKey: eve.keys.encryption.publicKey,
        }

        // 👩🏾 Alice is not fooled, because the link's hash no longer matches the computed hash of the head link
        expect(validate(graph)).not.toBeValid()
      })

      test('a link is missing', () => {
        const graph = setupGraph()
        const headLink = getHead(graph)[0]
        const prevLink = headLink.body.prev[0]
        delete graph.links[prevLink] // eslint-disable-line @typescript-eslint/no-dynamic-delete
        expect(validate(graph)).not.toBeValid()
      })

      test('a link is missing from the encryptedLinks', () => {
        const graph = setupGraph()
        const headLink = getHead(graph)[0]
        const prevLink = headLink.body.prev[0]
        delete graph.encryptedLinks[prevLink] // eslint-disable-line @typescript-eslint/no-dynamic-delete
        expect(validate(graph)).not.toBeValid()
      })

      test(`timestamp out of order`, () => {
        const IN_THE_PAST = new Date('2020-01-01').getTime()
        const graph = setupGraph()

        // 🦹‍♀️ Eve sets her system clock back when appending a link
        const now = Date.now()
        setSystemTime(IN_THE_PAST)
        const graph2 = append({
          graph,
          action: { type: 'FOO', payload: 'pizza' },
          user: eve,
          keys,
        })
        setSystemTime(now)

        expect(validate(graph2)).not.toBeValid()
      })

      test(`timestamp in the future`, () => {
        const IN_THE_FUTURE = new Date(`10000-01-01`).getTime() // NOTE: test will begin to fail 7,978 years from now
        const graph = setupGraph()

        // 🦹‍♀️ Eve sets her system clock forward when appending a link
        const now = Date.now()
        setSystemTime(IN_THE_FUTURE)
        const graph2 = append({
          graph,
          action: { type: 'FOO', payload: 'pizza' },
          user: eve,
          keys,
        })
        setSystemTime(now)

        expect(validate(graph2)).not.toBeValid()
      })
    })
  })
})
