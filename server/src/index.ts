import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
app.use(cors())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

// 简化的类型定义
interface Player {
  id: string
  name: string
  isOnline: boolean
}

interface Room {
  id: string
  name: string
  hostId: string
  players: Player[]
  maxPlayers: number
  status: 'waiting' | 'playing' | 'finished'
}

// 内存存储
const rooms = new Map<string, Room>()
const players = new Map<string, Player>()

io.on('connection', (socket) => {
  console.log(`玩家连接: ${socket.id}`)

  // 创建房间
  socket.on('room:create', (name: string, callback: (room: Room) => void) => {
    const roomId = `room_${Date.now()}`
    const player: Player = {
      id: socket.id,
      name: `玩家${socket.id.slice(0, 4)}`,
      isOnline: true
    }
    
    const room: Room = {
      id: roomId,
      name,
      hostId: socket.id,
      players: [player],
      maxPlayers: 4,
      status: 'waiting'
    }
    
    rooms.set(roomId, room)
    players.set(socket.id, player)
    socket.join(roomId)
    
    console.log(`房间已创建: ${roomId}`)
    callback(room)
  })

  // 加入房间
  socket.on('room:join', (roomId: string, callback: (room: Room | null) => void) => {
    const room = rooms.get(roomId)
    if (!room || room.players.length >= room.maxPlayers) {
      callback(null)
      return
    }

    const player: Player = {
      id: socket.id,
      name: `玩家${socket.id.slice(0, 4)}`,
      isOnline: true
    }

    room.players.push(player)
    players.set(socket.id, player)
    socket.join(roomId)

    io.to(roomId).emit('player:joined', player)
    callback(room)
  })

  // 离开房间
  socket.on('room:leave', () => {
    handlePlayerLeave(socket.id)
  })

  // 断开连接
  socket.on('disconnect', () => {
    console.log(`玩家断开: ${socket.id}`)
    handlePlayerLeave(socket.id)
  })
})

function handlePlayerLeave(playerId: string) {
  players.delete(playerId)
  
  for (const [roomId, room] of rooms) {
    const index = room.players.findIndex(p => p.id === playerId)
    if (index !== -1) {
      room.players.splice(index, 1)
      io.to(roomId).emit('player:left', playerId)
      
      if (room.players.length === 0) {
        rooms.delete(roomId)
        console.log(`房间已删除: ${roomId}`)
      }
      break
    }
  }
}

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`🚀 游戏服务器运行在 http://localhost:${PORT}`)
})