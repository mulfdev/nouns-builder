import * as Sentry from '@sentry/nextjs'

import { getProposalState } from 'src/data/contract/requests/getProposalState'
import { sdk } from 'src/data/subgraph/client'

import { Proposal } from './proposalQuery'

export interface ProposalsResponse {
  proposals: Proposal[]
  pageInfo?: {
    hasNextPage: boolean
  }
}

export const getProposals = async (
  token: string,
  limit: number = 100,
  page?: number
): Promise<ProposalsResponse> => {
  try {
    const data = await sdk.proposals({
      where: {
        dao: token,
      },
      first: limit,
      skip: page ? (page - 1) * limit : 0,
    })

    return {
      proposals: await Promise.all(
        data?.proposals.map(async (p) => {
          const { executableFrom, expiresAt, calldatas, ...proposal } = p

          const baseProposal = {
            ...proposal,
            calldatas: calldatas ? calldatas.split(':') : [],
            state: await getProposalState(
              proposal.dao.governorAddress,
              proposal.proposalId
            ),
          }

          // executableFrom and expiresAt will always either be both defined, or neither defined
          if (executableFrom && expiresAt) {
            return {
              ...baseProposal,
              executableFrom,
              expiresAt,
            }
          }
          return baseProposal
        })
      ),
      pageInfo: {
        hasNextPage: data.proposals.reverse()[0].proposalNumber !== 1,
      },
    }
  } catch (e) {
    Sentry.captureException(e)
    await Sentry.flush(2000)
    return {
      proposals: [],
    }
  }
}
