import React, { useRef, useMemo, useEffect, useState } from 'react'
import './App.css'
import { Editor } from '@monaco-editor/react'
import { MonacoBinding } from './y-monaco-binding.js'
import * as Y from 'yjs'
import { SocketIOProvider } from "y-socket.io"

const COLORS = [
    '#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6',
    '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#10b981'
]

export default function App() {
    const editorRef = useRef(null)
    const monacoRef = useRef(null)
    const ydoc = useMemo(() => new Y.Doc(), [])
    const yText = useMemo(() => ydoc.getText("monaco"), [ydoc])
    const providerRef = useRef(null)
    const bindingRef = useRef(null)

    const [users, setUsers] = useState([])
    const [connected, setConnected] = useState(false)

    // Retrieve persistence info from localStorage
    const [joined, setJoined] = useState(() => {
        return localStorage.getItem('collab_joined') === 'true'
    })
    const [localUser, setLocalUser] = useState(() => {
        const saved = localStorage.getItem('collab_user')
        return saved ? JSON.parse(saved) : null
    })

    // Temporary inputs for forms (Joining / Editing)
    const [tempName, setTempName] = useState(localUser?.name || '')
    const [tempColor, setTempColor] = useState(localUser?.color || COLORS[Math.floor(Math.random() * COLORS.length)])
    const [showEditModal, setShowEditModal] = useState(false)

    // Binding coordination helper to prevent race conditions
    const initializeBinding = () => {
        if (!editorRef.current || !monacoRef.current || !providerRef.current) return

        if (bindingRef.current) {
            bindingRef.current.destroy()
        }

        const binding = new MonacoBinding(
            yText,
            editorRef.current.getModel(),
            new Set([editorRef.current]),
            providerRef.current.awareness,
            monacoRef.current
        )
        bindingRef.current = binding
    }

    // Effect 1: Handle provider lifecycle when joined
    useEffect(() => {
        if (!joined) return

        const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"
        const provider = new SocketIOProvider(backendUrl, "monaco", ydoc, { autoConnect: true })
        providerRef.current = provider

        // Setup initial user state if available
        if (localUser) {
            provider.awareness.setLocalStateField('user', localUser)
        }

        // Listen to connection status
        const handleStatus = ({ status }) => {
            setConnected(status === 'connected')
        }
        provider.on('status', handleStatus)
        setConnected(provider.socket.connected)

        // Listen to awareness changes (users list)
        const handleAwareness = () => {
            const states = provider.awareness.getStates()
            const usersList = []
            states.forEach((state, clientId) => {
                if (state.user) {
                    usersList.push({
                        clientId,
                        name: state.user.name,
                        color: state.user.color,
                        isLocal: clientId === ydoc.clientID
                    })
                }
            })
            setUsers(usersList)
        }
        provider.awareness.on('change', handleAwareness)
        handleAwareness() // initial update

        // Dynamically inject CSS for remote selections and cursors
        const handleStyleUpdate = () => {
            let styleElement = document.getElementById('yjs-dynamic-styles')
            if (!styleElement) {
                styleElement = document.createElement('style')
                styleElement.id = 'yjs-dynamic-styles'
                document.head.appendChild(styleElement)
            }

            let styles = ''
            provider.awareness.getStates().forEach((state, clientId) => {
                if (state.user) {
                    const { name, color } = state.user
                    styles += `
                        .yRemoteSelection-${clientId} {
                            background-color: ${color}33;
                        }
                        .yRemoteSelectionHead-${clientId} {
                            border-left: 2px solid ${color};
                        }
                        .yRemoteSelectionHead-${clientId}::after {
                            content: '${name}';
                            background-color: ${color};
                        }
                    `
                }
            })
            styleElement.innerHTML = styles
        }
        provider.awareness.on('change', handleStyleUpdate)
        handleStyleUpdate() // initial update

        // Bind editor if it's already mounted
        initializeBinding()

        return () => {
            provider.off('status', handleStatus)
            provider.awareness.off('change', handleAwareness)
            provider.awareness.off('change', handleStyleUpdate)
            provider.destroy()
            providerRef.current = null
            const styleElement = document.getElementById('yjs-dynamic-styles')
            if (styleElement) {
                styleElement.remove()
            }
            if (bindingRef.current) {
                bindingRef.current.destroy()
                bindingRef.current = null
            }
        }
    }, [ydoc, joined])

    // Effect 2: Update awareness info when localUser state changes (prevents socket teardown)
    useEffect(() => {
        if (providerRef.current && localUser) {
            providerRef.current.awareness.setLocalStateField('user', localUser)
        }
    }, [localUser])

    const handleMount = (editor, monaco) => {
        editorRef.current = editor
        monacoRef.current = monaco
        initializeBinding()
    }

    useEffect(() => {
        return () => {
            if (bindingRef.current) {
                bindingRef.current.destroy()
            }
        }
    }, [])

    const handleJoin = (e) => {
        e.preventDefault()
        if (!tempName.trim()) return

        const userInfo = {
            name: tempName.trim(),
            color: tempColor
        }

        localStorage.setItem('collab_user', JSON.stringify(userInfo))
        localStorage.setItem('collab_joined', 'true')

        setLocalUser(userInfo)
        setJoined(true)
    }

    const handleSaveProfile = (e) => {
        e.preventDefault()
        if (!tempName.trim()) return

        const userInfo = {
            name: tempName.trim(),
            color: tempColor
        }

        localStorage.setItem('collab_user', JSON.stringify(userInfo))
        setLocalUser(userInfo)
        setShowEditModal(false)
    }

    const handleCancelEdit = () => {
        setTempName(localUser?.name || '')
        setTempColor(localUser?.color || COLORS[0])
        setShowEditModal(false)
    }

    const handleLeaveSession = () => {
        localStorage.removeItem('collab_joined')
        setJoined(false)
    }

    // Join screen view
    if (!joined) {
        return (
            <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
                {/* Decorative background gradients */}
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-fuchsia-900/10 blur-[120px] pointer-events-none" />

                <div className="w-full max-w-md bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl flex flex-col gap-6 relative z-10">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <span className="font-bold text-lg text-white">C</span>
                        </div>
                        <div>
                            <h1 className="font-bold text-2xl tracking-tight bg-gradient-to-r from-violet-200 to-fuchsia-200 bg-clip-text text-transparent">CollabCode</h1>
                            <p className="text-xs text-slate-400 mt-1">Real-time Collaborative Development Environment</p>
                        </div>
                    </div>

                    <form onSubmit={handleJoin} className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                required
                                placeholder="Enter your name..."
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                maxLength={25}
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all text-sm"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Choose Cursor Color
                            </label>
                            <div className="grid grid-cols-5 gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800/50">
                                {COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setTempColor(color)}
                                        className="h-8 w-8 rounded-full border-2 transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center relative"
                                        style={{
                                            backgroundColor: color,
                                            borderColor: tempColor === color ? '#ffffff' : 'transparent',
                                            boxShadow: tempColor === color ? `0 0 12px ${color}` : 'none'
                                        }}
                                    >
                                        {tempColor === color && (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white">
                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full mt-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 active:scale-[0.98] cursor-pointer text-sm"
                        >
                            Join Collaborative Session
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <main className="h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
            {/* Navbar Header */}
            <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                        <span className="font-bold text-sm text-white">C</span>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-none tracking-tight">CollabCode</h1>
                        <span className="text-[10px] text-slate-500">Real-time Collaborative IDE</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/50 text-xs">
                        <span className="text-slate-400">Room:</span>
                        <span className="font-mono text-fuchsia-400 font-semibold">monaco</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                            {connected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                </div>
            </header>

            {/* Main Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside className="w-80 border-r border-slate-800 bg-slate-900/40 p-4 flex flex-col gap-6 shrink-0 overflow-y-auto">
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Your Session</h2>
                        {localUser && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 group">
                                <div className="flex items-center gap-3">
                                    <span className="h-4 w-4 rounded-full border-2 border-slate-900 shadow-md shrink-0" style={{ backgroundColor: localUser.color }} />
                                    <span className="text-sm font-medium text-slate-200 truncate max-w-[130px]" title={localUser.name}>{localUser.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setShowEditModal(true)}
                                        className="text-[10px] text-slate-400 hover:text-violet-400 hover:bg-slate-800 px-2 py-1 rounded transition-all cursor-pointer font-medium"
                                        title="Edit Profile"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={handleLeaveSession}
                                        className="text-[10px] text-slate-400 hover:text-rose-400 hover:bg-slate-800 px-2 py-1 rounded transition-all cursor-pointer font-medium"
                                        title="Leave Session"
                                    >
                                        Leave
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col flex-1">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Active Collaborators</h2>
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-bold text-violet-400 border border-slate-700/50">
                                {users.length} online
                            </span>
                        </div>

                        <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] pr-1">
                            {users.map((user) => (
                                <div key={user.clientId} className={`flex items-center justify-between p-2.5 rounded-lg border text-sm transition-all duration-200 ${user.isLocal ? 'bg-violet-950/20 border-violet-800/20' : 'bg-slate-800/20 border-slate-700/10'}`}>
                                    <div className="flex items-center gap-2.5">
                                        <span className="h-3 w-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: user.color }} />
                                        <span className={`font-medium ${user.isLocal ? 'text-violet-200' : 'text-slate-300'} truncate max-w-[150px]`} title={user.name}>
                                            {user.name}
                                        </span>
                                    </div>
                                    {user.isLocal && (
                                        <span className="text-[10px] font-bold uppercase text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded shrink-0">You</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Editor Container */}
                <section className="flex-1 bg-slate-950 p-4 overflow-hidden flex flex-col">
                    <div className="flex-1 rounded-xl overflow-hidden border border-slate-800 shadow-2xl relative">
                        <Editor
                            height="100%"
                            defaultLanguage="javascript"
                            defaultValue="// Write your code here"
                            onMount={handleMount}
                            theme="vs-dark"
                            options={{
                                fontSize: 14,
                                fontFamily: "'Fira Code', 'Courier New', Courier, monospace",
                                minimap: { enabled: true },
                                cursorBlinking: "smooth",
                                cursorSmoothCaretAnimation: "on",
                                wordWrap: "on",
                                border: "none",
                                padding: { top: 12 },
                            }}
                        />
                    </div>
                </section>
            </div>

            {/* Edit Profile Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl flex flex-col gap-5 relative animate-none">
                        <div>
                            <h3 className="font-bold text-lg text-slate-100">Edit Profile</h3>
                            <p className="text-xs text-slate-400 mt-1">Update your presence details for this collaboration session.</p>
                        </div>

                        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="edit-username" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Username
                                </label>
                                <input
                                    id="edit-username"
                                    type="text"
                                    required
                                    placeholder="Enter your name..."
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    maxLength={25}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all text-sm"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Cursor Color
                                </label>
                                <div className="grid grid-cols-5 gap-2.5 p-2 rounded-xl bg-slate-950 border border-slate-800">
                                    {COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setTempColor(color)}
                                            className="h-8 w-8 rounded-full border-2 transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center relative"
                                            style={{
                                                backgroundColor: color,
                                                borderColor: tempColor === color ? '#ffffff' : 'transparent',
                                                boxShadow: tempColor === color ? `0 0 10px ${color}` : 'none'
                                            }}
                                        >
                                            {tempColor === color && (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white">
                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-md shadow-violet-500/10 cursor-pointer"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    )
}

