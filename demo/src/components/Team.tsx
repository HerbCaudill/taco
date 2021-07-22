import * as auth from '@localfirst/auth'
import { Button, CardBody } from '@windmill/react-ui'
import debug from 'debug'
import React from 'react'
import { useTeam } from '../hooks/useTeam'
import { users } from '../users'
import { assert } from '@/util/assert'
import { CardLabel } from './CardLabel'
import { ChainDiagram } from './ChainDiagram'
import { Invite } from './Invite'
import { OnlineToggle } from './OnlineToggle'
import { StatusIndicator } from './StatusIndicator'

export const Team = () => {
  const { team, user, device, online, connect, disconnect, connectionStatus } = useTeam()
  assert(team) // we know we're on a team if we're showing this component

  const log = debug(`lf:auth:demo:Team:${user.userName}`)

  const userBelongsToTeam = team.has(user.userName)
  const userIsAdmin = userBelongsToTeam && team.memberIsAdmin(user.userName)
  const adminCount = () => team.members().filter(m => team.memberIsAdmin(m.userName)).length

  return (
    <>
      <CardBody className="Team">
        {/* Team name */}
        <div className="flex">
          <div className="flex-grow">
            <CardLabel>Team</CardLabel>
            <p className="TeamName">{team.teamName}</p>
          </div>

          {/* Online/offline switch */}
          <div className="text-right">
            <OnlineToggle
              isOnline={online}
              onChange={isConnected => {
                if (isConnected) {
                  const context = { user, device, team }
                  log(`reconnecting, public encryption key: ${user.keys.encryption.publicKey}`)
                  connect(team.teamName, context)
                } else {
                  disconnect()
                }
              }}
            />
          </div>
        </div>

        {/* Members table */}
        <table className="MemberTable w-full border-collapse text-sm my-3">
          <tbody>
            {/* One row per member */}
            {team.members()?.map(m => {
              const isAdmin = team.memberIsAdmin(m.userName)
              const isOnlyAdmin = isAdmin && adminCount() === 1
              const status = connectionStatus[m.userName] || 'disconnected'

              const adminToggleTitle = userIsAdmin
                ? isOnlyAdmin
                  ? `Can't remove the only admin`
                  : isAdmin
                  ? 'Team admin (click to remove)'
                  : 'Click to make team admin'
                : isAdmin
                ? 'Team admin'
                : 'Not admin'

              return (
                <tr key={m.userName} className="border-t border-b border-gray-200 group">
                  {/* Admin icon */}
                  <td className="w-2">
                    <Button
                      layout="link"
                      size="small"
                      disabled={!userIsAdmin || isOnlyAdmin}
                      onClick={() => {
                        if (isAdmin) team.removeMemberRole(m.userName, auth.ADMIN)
                        else team.addMemberRole(m.userName, auth.ADMIN)
                      }}
                      title={adminToggleTitle}
                      className={`px-1 m-1 hover:opacity-25  ${
                        isAdmin ? 'opacity-100' : 'opacity-0 disabled:opacity-0 '
                      }`}
                      children="👑"
                    />
                  </td>

                  {/* Name & emoji */}
                  <td className="p-2">
                    {users[m.userName].emoji} <span className="UserName">{m.userName}</span>
                  </td>

                  {/* Connection status: Laptop */}
                  <td title={status}>
                    {m.userName === user.userName ? null : (
                      <div className="flex items-center">
                        <span className="mr-2">💻</span>
                        <StatusIndicator status={status} />
                      </div>
                    )}
                  </td>

                  {/* Remove button */}
                  <td>
                    {userIsAdmin && !isOnlyAdmin ? (
                      <button
                        title="Remove member from team"
                        className="hover:opacity-100 opacity-10 font-bold"
                        onClick={() => {
                          // TODO: need to handle this gracefully - what should Bob see after he is removed?
                          team.remove(m.userName)
                        }}
                        children="⛔"
                      />
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Invitation UI */}
        <Invite />
      </CardBody>

      {/* Chain visualization */}
      <CardBody className="border-t">
        <CardLabel>Signature chain</CardLabel>
        <ChainDiagram chain={team.chain} id={user.userName} />
      </CardBody>
    </>
  )
}
