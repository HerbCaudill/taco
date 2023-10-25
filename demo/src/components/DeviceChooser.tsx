import React, { useRef } from 'react'
import { type PeerMap } from '../peers'

export const DeviceChooser = ({ onAdd, peers }: ChooserProps) => {
  const peerSelect = useRef() as React.MutableRefObject<HTMLSelectElement>

  return (
    <div className="Chooser group flex-grow">
      <select
        ref={peerSelect}
        className={`
          bg-color-none opacity-25
          group-hover:opacity-100 group-hover:bg-color-white
          focus:opacity-100 focus:bg-color-white
          border-none rounded-lg 
          p-2 pr-4 h-10 font-normal text-lg`}
        onChange={() => {
          peerSelect.current.blur()
          onAdd(peerSelect.current.value)
        }}
      >
        <option>Show device...</option>
        {Object.values(peers)
          .filter(p => !p.show)
          .map(p => (
            <option key={p.id} value={p.id}>
              {p.user.emoji} {p.device.emoji}
            </option>
          ))}
      </select>
    </div>
  )
}

type ChooserProps = {
  onAdd: (id: string) => void
  peers: PeerMap
}
