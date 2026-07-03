import { insertCoin } from 'playroomkit'
import type { InitOptions } from 'playroomkit'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './components/App'
import { CONFIG } from './game/config'
import { GameEngineProvider } from './multiplayer/useGameEngine'
import { GAME_ID } from './playroomConfig'
import './index.css'

const options: InitOptions = {
  maxPlayersPerRoom: CONFIG.maxPlayers,
  reconnectGracePeriod: 30_000
}
if (GAME_ID) options.gameId = GAME_ID

const root = ReactDOM.createRoot(document.getElementById('root')!)

insertCoin(options)
  .then(() => {
    root.render(
      <React.StrictMode>
        <GameEngineProvider>
          <App />
        </GameEngineProvider>
      </React.StrictMode>
    )
  })
  .catch((err: Error) => {
    root.render(
      <div className="fatal">
        <h1>Churrasco 🔥</h1>
        <p>
          Não foi possível conectar ao Playroom: {String(err?.message ?? err)}
        </p>
        <p>
          Se o erro citar <code>gameId</code>, crie um projeto grátis em{' '}
          <a href="https://dev.joinplayroom.com">dev.joinplayroom.com</a> e
          preencha <code>src/playroomConfig.ts</code>.
        </p>
      </div>
    )
  })
