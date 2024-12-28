import * as auth from '@localfirst/auth'
import { createId } from '@paralleldrive/cuid2'
import * as React from 'react'
import { type AlertInfo, type PeerState } from '../types.js'
import { assert } from '@localfirst/shared'
import { ConnectionManager } from 'ConnectionManager.js'
import { teamContext } from 'components/TeamProvider.js'
import { randomTeamName } from '../util/randomTeamName.js'

// TODO: make this an environment var
const relayUrls = ['ws://localhost:8080']

export const useTeam = () => {
  const context = React.useContext(teamContext)
  assert(context, `useTeam must be used within a TeamProvider`)

  const [peerState, setPeerState] = context
  const { userName, userId, user, team, device } = peerState
  const head = team?.graph?.head

  React.useEffect(() => {
    if (team) {
      const updateTeamState = () => setPeerState(prev => ({ ...prev, state: team.state }))
      team.addListener('updated', updateTeamState)
      return () => {
        team.removeListener('updated', updateTeamState)
      }
    }
  }, [team])

  React.useEffect(() => {
    // clear the team if the user is no longer a member
    if (!team?.has(userId)) {
      clearTeam()
    }
  }, [team, head])

  const clearTeam = () => {
    setPeerState(prev => {
      const { team, ...stateMinusTeam } = prev
      return stateMinusTeam
    })
  }

  const addAlert = (message: string, type: AlertInfo['type'] = 'info') => {
    setPeerState(prev => {
      const alert = { id: createId(), message, type }
      return {
        ...prev,
        alerts: prev.alerts.concat(alert),
      }
    })
  }

  const clearAlert = (id: string) => {
    setPeerState(prev => ({
      ...prev,
      alerts: prev.alerts.filter(alert => alert.id !== id),
    }))
  }

  const setTeam = (newTeam: auth.Team) => {
    setPeerState(prev => {
      return {
        ...prev,
        team: newTeam,
        teamState: newTeam.state,
      }
    })
  }

  const createTeam = () => {
    assert(user)
    const team = auth.createTeam(randomTeamName(), { user, device })
    setPeerState((prev: PeerState) => {
      return {
        ...prev,
        team,
        teamState: team.state,
      }
    })

    const { teamName } = team
    const context = { userName, user, device, team, teamKeys: team.teamKeys() }
    connect(teamName, context)
  }

  const joinTeam = (teamName: string, invitationSeed: string) => {
    const context = { userName, userId, user, device, invitationSeed }
    connect(teamName, context)
  }

  const connect = (teamName: string, context: auth.InviteeContext | auth.MemberContext) => {
    const connectionManager = new ConnectionManager({
      teamName,
      urls: relayUrls,
      context,
    })

      // when we connect to the relay, set our online status to true and expose our connection status
      .on('server-connect', () => {
        setPeerState(prev => ({
          ...prev,
          online: true,
          connectionStatus: connectionManager.connectionStatus,
        }))
      })

      // when our connection status changes, update it
      .on('change', () => {
        setPeerState((prev: PeerState) => ({
          ...prev,
          connectionStatus: connectionManager.connectionStatus,
        }))
      })

      // when we disconnect from the relay, set our online status to false and clear our connection status
      .on('server-disconnect', () => {
        setPeerState(prev => ({
          ...prev,
          online: false,
          connectionStatus: {},
        }))
      })

      // when we join a team, expose it to the app (and update our user, in case it has new info)
      .on('joined', ({ team, user }) => {
        setPeerState(prev => ({
          ...prev,
          team,
          user,
        }))
      })

      // when we connect to a peer, expose the latest team info from the connection
      .on('connected', (connection: auth.Connection) => {
        setTeam(connection.team)
      })

      .on('remoteError', (error: auth.connection.ConnectionErrorPayload) => {
        switch (error.type) {
          case 'MEMBER_UNKNOWN':
          case 'MEMBER_REMOVED': {
            clearTeam()
            break
          }
        }

        // if we have a detailed error message, use that
        const message = error.details ?? error.message
        addAlert(message)
      })

      // when we disconnect from a peer, update our connection status
      .on('disconnected', (_id, event) => {
        setPeerState((prev: PeerState) => ({
          ...prev,
          connectionStatus: connectionManager.connectionStatus,
        }))
      })

    setPeerState(prev => ({
      ...prev,
      connectionManager,
    }))
  }

  const disconnect = () => {
    if (!peerState.connectionManager) return
    peerState.connectionManager.disconnectServer()
  }

  return {
    ...peerState,
    addAlert,
    clearAlert,
    createTeam,
    joinTeam,
    connect,
    disconnect,
  }
}
