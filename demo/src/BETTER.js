import React, { useState, useRef, useEffect } from 'react';

const MESISimulator = () => {
    const [clock, setClock] = useState(0);
    const [activeTransfers, setActiveTransfers] = useState([]);
    const [highlightedNodes, setHighlightedNodes] = useState({});
    const [actionHistory, setActionHistory] = useState([]);

    // Data State
    const [objectsInMemory, setObjectsInMemory] = useState({
        "0x100": "Data A",
        "0x104": "Data B",
        "0x108": "Data C"
    });

    const [cores, setCores] = useState([
        { "0x100": ["Data F", "M"], "0x104": ["Data G", "I"] },
        { "0x108": ["Data C", "E"] },
        {},
        {}
    ]);

    // Input State
    const [opCore, setOpCore] = useState(0);
    const [opAddr, setOpAddr] = useState("0x100");
    const [opVal, setOpVal] = useState("NewData");

    // Action State
    const [currentAction, setCurrentAction] = useState(null);
    const currentActionRef = useRef([]);
    const logsEndRef = useRef(null); // Ref for auto-scrolling

    // --- Animation Constants ---
    const STEP_DELAY = 1200;
    const LONG_DELAY = 1600;
    const TRANSFER_SPEED = 0.015; // Slightly faster for smoother visual
    const TRANSFER_DURATION = 2500;

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // --- Auto-Scroll Effect ---
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [actionHistory, currentAction]);

    const addToCurrentAction = (msg) => {
        currentActionRef.current = [...currentActionRef.current, msg];
        setCurrentAction([...currentActionRef.current]);
    };

    const finalizeAction = (command) => {
        const stepsToSave = [...currentActionRef.current];
        setActionHistory(prev => [...prev, {
            command,
            steps: stepsToSave,
            timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }]); // We keep history growing (or you can slice it if it gets too big)

        currentActionRef.current = [];
        setCurrentAction(null);
    };

    const animateTransfer = (from, to, data, color = '#fff') => {
        const id = Date.now() + Math.random();
        setActiveTransfers(prev => [...prev, { id, from, to, data, color, progress: 0 }]);

        const interval = setInterval(() => {
            setActiveTransfers(prev => {
                const updated = prev.map(t =>
                    t.id === id ? { ...t, progress: t.progress + TRANSFER_SPEED } : t
                );
                // Clean up finished transfers
                return updated.filter(t => t.progress < 1);
            });
        }, 16); // ~60fps

        setTimeout(() => clearInterval(interval), TRANSFER_DURATION);
    };

    const highlightNode = (node, duration = 2000) => {
        setHighlightedNodes(prev => ({ ...prev, [node]: true }));
        setTimeout(() => {
            setHighlightedNodes(prev => ({ ...prev, [node]: false }));
        }, duration);
    };

    const getNodePosition = (type, index = 0) => {
        const CX = 400;
        const CY = 300;
        if (type === 'memory') return { x: CX, y: 550 };
        if (type === 'bus') return { x: CX, y: CY };
        const positions = [
            { x: CX - 220, y: CY - 180 }, // Moved out slightly for space
            { x: CX + 220, y: CY - 180 },
            { x: CX + 220, y: CY + 100 },
            { x: CX - 220, y: CY + 100 },
        ];
        return positions[index] || { x: CX, y: CY };
    };

    // --- Helpers for Deep Copy ---
    const deepCopy = (obj) => {
        if (typeof structuredClone === 'function') return structuredClone(obj);
        return JSON.parse(JSON.stringify(obj));
    };

    // --- Log Parsing Logic ---
    const parseLogMessage = (msg) => {
        // Regex to find tags like [HIT], [BUS], etc.
        const match = msg.match(/^\[([A-Z]+)\]\s*(.*)/);
        if (!match) return { tag: 'INFO', text: msg, color: '#9ca3af', bg: 'transparent' };

        const tag = match[1];
        const text = match[2];

        let color = '#fff';
        let bg = '#333';
        let borderColor = '#444';

        switch (tag) {
            case 'HIT':
            case 'CMD':
                color = '#22c55e'; bg = 'rgba(34, 197, 94, 0.1)'; borderColor = '#22c55e'; break;
            case 'MISS':
            case 'INV':
                color = '#ef4444'; bg = 'rgba(239, 68, 68, 0.1)'; borderColor = '#ef4444'; break;
            case 'BUS':
                color = '#f59e0b'; bg = 'rgba(245, 158, 11, 0.1)'; borderColor = '#f59e0b'; break;
            case 'MEM':
                color = '#3b82f6'; bg = 'rgba(59, 130, 246, 0.1)'; borderColor = '#3b82f6'; break;
            case 'STATE':
                color = '#a855f7'; bg = 'rgba(168, 85, 247, 0.1)'; borderColor = '#a855f7'; break;
            case 'WRT':
            case 'VAL':
                color = '#06b6d4'; bg = 'rgba(6, 182, 212, 0.1)'; borderColor = '#06b6d4'; break;
            default: break;
        }

        return { tag, text, color, bg, borderColor };
    };

    // --- MESI Logic (Unchanged but cleaned) ---

    const addObjectToMemory = async (memory_address, value) => {
        setObjectsInMemory(prev => ({ ...prev, [memory_address]: value }));
        setClock(prev => prev + 100);
        highlightNode('memory', LONG_DELAY);
        addToCurrentAction(`[MEM] Written ${value} at ${memory_address}`);
        await delay(STEP_DELAY);
    };

    const readFromMemory = async (memory_address) => {
        setClock(prev => prev + 100);
        highlightNode('memory', LONG_DELAY);
        addToCurrentAction(`[MEM] Reading ${memory_address}`);
        await delay(STEP_DELAY);
        return objectsInMemory[memory_address] || "ERROR";
    };

    const shareCache = async (memory_address, cache_value, fromCore, toCore) => {
        addToCurrentAction(`[BUS] Core ${fromCore} shares to Core ${toCore}`);
        animateTransfer(`core${fromCore}`, `core${toCore}`, cache_value, '#4ade80');
        await delay(LONG_DELAY);
        setClock(prev => prev + 5);
        setCores(prev => {
            const newCores = [...prev];
            newCores[toCore] = { ...newCores[toCore], [memory_address]: [cache_value, "S"] };
            return newCores;
        });
    };

    const busRead = async (from_core_index, memory_address) => {
        addToCurrentAction(`[BUS] Core ${from_core_index} broadcasts Read Request`);
        highlightNode('bus', 2500);

        for (let i = 0; i < cores.length; i++) {
            if (i !== from_core_index) {
                animateTransfer('bus', `core${i}`, '?', '#fbbf24');
            }
        }
        await delay(STEP_DELAY);

        let tempCores = deepCopy(cores);
        let foundValue = null;
        let foundInCore = -1;

        for (let i = 0; i < tempCores.length; i++) {
            setClock(prev => prev + 1);
            if (i === from_core_index) continue;

            const core = tempCores[i];
            if (core[memory_address]) {
                const [value, state] = core[memory_address];
                if (state === 'I') continue;

                if (state === 'M') {
                    addToCurrentAction(`[HIT] Core ${i} has Modified (M) data`);
                    addToCurrentAction(`[BUS] Core ${i} writes back to RAM`);
                    addToCurrentAction(`[STATE] Core ${i} M -> S`);

                    highlightNode(`core${i}`, LONG_DELAY);
                    animateTransfer(`core${i}`, 'memory', value, '#ef4444');
                    await delay(LONG_DELAY);

                    await addObjectToMemory(memory_address, value);
                    tempCores[i][memory_address][1] = "S";
                    foundValue = value;
                    foundInCore = i;
                    break;
                } else if (state === 'E') {
                    addToCurrentAction(`[HIT] Core ${i} has Exclusive (E) data`);
                    addToCurrentAction(`[STATE] Core ${i} E -> S`);
                    highlightNode(`core${i}`, LONG_DELAY);
                    tempCores[i][memory_address][1] = "S";
                    foundValue = value;
                    foundInCore = i;
                    break;
                } else if (state === 'S') {
                    addToCurrentAction(`[HIT] Core ${i} has Shared (S) copy`);
                    highlightNode(`core${i}`, LONG_DELAY);
                    foundValue = value;
                    foundInCore = i;
                    break;
                }
            }
        }

        setCores(tempCores);

        if (foundValue !== null) {
            addToCurrentAction(`[BUS] Receiving data from Core ${foundInCore}`);
            await shareCache(memory_address, foundValue, foundInCore, from_core_index);
            return foundValue;
        }

        addToCurrentAction(`[MISS] No core has valid copy`);
        addToCurrentAction(`[MEM] Fetching from Main Memory`);
        animateTransfer('memory', `core${from_core_index}`, memory_address, '#3b82f6');
        await delay(LONG_DELAY);

        const correct_value = await readFromMemory(memory_address);
        addToCurrentAction(`[STATE] Core ${from_core_index} set to Exclusive (E)`);

        setCores(prev => {
            const c = [...prev];
            c[from_core_index] = { ...c[from_core_index], [memory_address]: [correct_value, "E"] };
            return c;
        });

        return correct_value;
    };

    const kickAllCores = async (memory_address, current_core_index) => {
        addToCurrentAction(`[BUS] Broadcasting Invalidation (RWITM)`);
        highlightNode('bus', 2500);

        for (let i = 0; i < cores.length; i++) {
            if (i !== current_core_index && cores[i][memory_address]) {
                animateTransfer('bus', `core${i}`, 'INV', '#ef4444');
                highlightNode(`core${i}`, 1500);
                addToCurrentAction(`[INV] Core ${i} invalidated`);
            }
        }
        await delay(LONG_DELAY);

        setCores(prev => prev.map((core, i) => {
            if (i === current_core_index) return core;
            if (core[memory_address]) {
                return { ...core, [memory_address]: [core[memory_address][0], 'I'] };
            }
            return core;
        }));
        setClock(prev => prev + 1);
    };

    const handleRead = async () => {
        currentActionRef.current = [];
        const command = `READ: Core ${opCore} -> ${opAddr}`;
        addToCurrentAction(`[CMD] ${command}`);
        highlightNode(`core${opCore}`, 2000);

        const cache = cores[opCore];
        if (!cache[opAddr] || cache[opAddr][1] === "I") {
            addToCurrentAction(`[MISS] Core ${opCore} Cache miss`);
            await delay(STEP_DELAY);
            await busRead(opCore, opAddr);
        } else {
            const [val, state] = cache[opAddr];
            addToCurrentAction(`[HIT] Core ${opCore} HIT (State: ${state})`);
            addToCurrentAction(`[VAL] Value: ${val}`);
            setClock(prev => prev + 1);
        }
        finalizeAction(command);
    };

    const handleWrite = async () => {
        currentActionRef.current = [];
        const command = `WRITE: Core ${opCore} -> ${opAddr} = ${opVal}`;
        addToCurrentAction(`[CMD] ${command}`);
        highlightNode(`core${opCore}`, 2000);

        let state = cores[opCore][opAddr] ? cores[opCore][opAddr][1] : "I";
        if (state === "S" || state === "I") {
            addToCurrentAction(`[BUS] State is ${state}, requesting ownership`);
            await delay(STEP_DELAY);
            await kickAllCores(opAddr, opCore);
            state = "E";
        }

        addToCurrentAction(`[WRT] Writing new value: ${opVal}`);
        addToCurrentAction(`[STATE] Core ${opCore} Transitioning to M`);
        setCores(prev => {
            const newCores = [...prev];
            newCores[opCore] = { ...newCores[opCore], [opAddr]: [opVal, "M"] };
            return newCores;
        });
        setClock(prev => prev + 1);
        finalizeAction(command);
    };

    // --- Render Components ---

    const LogItem = ({ message }) => {
        const { tag, text, color, bg, borderColor } = parseLogMessage(message);
        return (
            <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: '1.4' }}>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    color: color,
                    border: `1px solid ${borderColor}`,
                    backgroundColor: bg,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    minWidth: '45px',
                    textAlign: 'center',
                    marginTop: '2px'
                }}>
                    {tag}
                </span>
                <span style={{ color: '#d4d4d4' }}>{text}</span>
            </div>
        );
    };

    return (
        <div style={{
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            background: '#0a0a0a',
            color: '#e0e0e0',
            minHeight: '100vh',
            padding: '40px',
            boxSizing: 'border-box'
        }}>
            {/* Header */}
            <div style={{
                borderBottom: '1px solid #262626',
                paddingBottom: '20px',
                marginBottom: '30px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: '#fff', letterSpacing: '-0.5px' }}>
                        MESI Protocol Simulator
                    </h1>
                    <div style={{ color: '#666', marginTop: '5px', fontSize: '0.9rem' }}>Visualizing Cache Coherence</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '2rem', lineHeight: '1', fontWeight: '700', fontFamily: 'monospace', color: '#fff' }}>
                        {clock}
                    </div>
                    <div style={{ color: '#555', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
                        Total Cycles
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '30px', alignItems: 'start' }}>
                {/* Left Panel: Controls & Logs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 150px)' }}>

                    {/* Controls */}
                    <div style={{ background: '#111', border: '1px solid #262626', padding: '20px', borderRadius: '12px' }}>
                        <div style={{ color: '#666', fontSize: '0.75rem', marginBottom: '15px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                            Operation
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <select
                                    style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #333', padding: '10px', borderRadius: '6px', flex: 1, outline: 'none' }}
                                    value={opCore}
                                    onChange={e => setOpCore(Number(e.target.value))}
                                >
                                    {cores.map((_, i) => <option key={i} value={i}>Core {i}</option>)}
                                </select>
                                <input
                                    style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #333', padding: '10px', borderRadius: '6px', width: '80px', fontFamily: 'monospace', textAlign: 'center', outline: 'none' }}
                                    value={opAddr}
                                    onChange={e => setOpAddr(e.target.value)}
                                />
                            </div>
                            <input
                                style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #333', padding: '10px', borderRadius: '6px', outline: 'none' }}
                                value={opVal}
                                onChange={e => setOpVal(e.target.value)}
                                placeholder="Value..."
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '5px' }}>
                                <button
                                    onClick={handleRead}
                                    disabled={currentAction !== null}
                                    style={{
                                        background: currentAction ? '#333' : '#fff',
                                        color: currentAction ? '#888' : '#000',
                                        border: 'none',
                                        padding: '12px',
                                        borderRadius: '6px',
                                        cursor: currentAction ? 'not-allowed' : 'pointer',
                                        fontWeight: '600',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    READ
                                </button>
                                <button
                                    onClick={handleWrite}
                                    disabled={currentAction !== null}
                                    style={{
                                        background: 'transparent',
                                        color: currentAction ? '#444' : '#fff',
                                        border: '1px solid #333',
                                        borderColor: currentAction ? '#333' : '#fff',
                                        padding: '12px',
                                        borderRadius: '6px',
                                        cursor: currentAction ? 'not-allowed' : 'pointer',
                                        fontWeight: '600',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    WRITE
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Logs */}
                    <div style={{
                        background: '#111',
                        border: '1px solid #262626',
                        borderRadius: '12px',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{
                            padding: '15px',
                            borderBottom: '1px solid #262626',
                            background: '#161616',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '700' }}>Event Log</span>
                            <span style={{ fontSize: '10px', color: '#444' }}>● Live</span>
                        </div>

                        <div style={{
                            padding: '15px',
                            overflowY: 'auto',
                            fontFamily: 'Menlo, Monaco, Consolas, monospace',
                            fontSize: '0.8rem',
                            flex: 1
                        }}>
                            {/* History Items */}
                            {actionHistory.map((action, idx) => (
                                <div key={idx} style={{ marginBottom: '15px', opacity: 0.7 }}>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '6px', alignItems: 'center' }}>
                                        <span style={{ color: '#555', fontSize: '0.7rem' }}>{action.timestamp}</span>
                                        <span style={{ color: '#fff', fontWeight: 'bold' }}>Command Completed</span>
                                    </div>
                                    <div style={{ paddingLeft: '10px', borderLeft: '2px solid #333' }}>
                                        {action.steps.map((step, sIdx) => <LogItem key={sIdx} message={step} />)}
                                    </div>
                                </div>
                            ))}

                            {/* Current Action (Live) */}
                            {currentAction && (
                                <div style={{ marginBottom: '10px', animation: 'fadeIn 0.3s' }}>
                                    <div style={{ color: '#4ade80', marginBottom: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', background: '#4ade80', borderRadius: '50%' }}></div>
                                        Executing...
                                    </div>
                                    <div style={{ paddingLeft: '10px', borderLeft: '2px solid #4ade80' }}>
                                        {currentAction.map((step, i) => <LogItem key={i} message={step} />)}
                                    </div>
                                </div>
                            )}

                            <div ref={logsEndRef} />
                        </div>
                    </div>
                </div>

                {/* Right Panel: Visualization */}
                <div style={{
                    position: 'relative',
                    border: '1px solid #262626',
                    borderRadius: '12px',
                    background: '#050505',
                    fontFamily: 'Menlo, Monaco, Consolas, monospace',
                    height: '100%',
                    minHeight: '600px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                }}>
                    <svg width="100%" height="100%" viewBox="0 0 800 600">
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#333" />
                            </marker>
                        </defs>

                        {/* Connection lines */}
                        <g stroke="#333" strokeWidth="2">
                            {cores.map((_, i) => {
                                const p = getNodePosition('core', i);
                                const bus = getNodePosition('bus');
                                return <line key={i} x1={p.x} y1={p.y} x2={bus.x} y2={bus.y} markerEnd="url(#arrowhead)" />;
                            })}
                            <line
                                x1={getNodePosition('memory').x}
                                y1={getNodePosition('memory').y}
                                x2={getNodePosition('bus').x}
                                y2={getNodePosition('bus').y}
                                markerEnd="url(#arrowhead)"
                            />
                        </g>

                        {/* Transfers */}
                        {activeTransfers.map(t => {
                            const start = getNodePosition(...t.from.split(/(\d+)/));
                            const end = getNodePosition(...t.to.split(/(\d+)/));
                            const x = start.x + (end.x - start.x) * t.progress;
                            const y = start.y + (end.y - start.y) * t.progress;
                            return (
                                <g key={t.id}>
                                    <circle cx={x} cy={y} r="8" fill={t.color} stroke="#000" strokeWidth="2" />
                                    <text
                                        x={x + 14}
                                        y={y + 4}
                                        fill={t.color}
                                        fontSize="12"
                                        fontWeight="bold"
                                        style={{ textShadow: '0px 1px 4px #000' }}
                                    >
                                        {t.data}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Main Memory */}
                        <g transform={`translate(${getNodePosition('memory').x}, ${getNodePosition('memory').y})`}>
                            <rect
                                x="-100"
                                y="-50"
                                width="200"
                                height="100"
                                fill="#111"
                                rx="6"
                                stroke={highlightedNodes['memory'] ? '#3b82f6' : '#333'}
                                strokeWidth={highlightedNodes['memory'] ? 3 : 1}
                            />
                            <text y="-60" textAnchor="middle" fill="#666" fontSize="12" letterSpacing="2px" fontWeight="bold">
                                MAIN MEMORY
                            </text>
                            <g transform="translate(-90, -20)" fontSize="12">
                                {Object.entries(objectsInMemory).map(([k, v], i) => (
                                    <text key={k} y={i * 24} fill="#888" fontFamily="monospace">
                                        {k}: <tspan fill="#ccc">{v}</tspan>
                                    </text>
                                ))}
                            </g>
                        </g>

                        {/* Bus */}
                        <g transform={`translate(${getNodePosition('bus').x}, ${getNodePosition('bus').y})`}>
                            <circle
                                r="45"
                                fill="#111"
                                stroke={highlightedNodes['bus'] ? '#f59e0b' : '#333'}
                                strokeWidth={highlightedNodes['bus'] ? 3 : 1}
                            />
                            <text dy="5" textAnchor="middle" fill="#666" fontSize="12" fontWeight="bold" letterSpacing="1px">
                                BUS
                            </text>
                        </g>

                        {/* Cores */}
                        {cores.map((cache, i) => {
                            const pos = getNodePosition('core', i);
                            const isHighlight = highlightedNodes[`core${i}`];
                            return (
                                <g key={i} transform={`translate(${pos.x}, ${pos.y})`}>
                                    <rect
                                        x="-90"
                                        y="-70"
                                        width="180"
                                        height="140"
                                        fill="#111"
                                        rx="6"
                                        stroke={isHighlight ? '#fff' : '#333'}
                                        strokeWidth={isHighlight ? 3 : 1}
                                        style={{ transition: 'stroke 0.2s' }}
                                    />
                                    <text y="-80" x="-90" fill="#888" fontSize="12" letterSpacing="1px" fontWeight="bold">
                                        CORE {i}
                                    </text>

                                    {/* Cache Table Header */}
                                    <g transform="translate(-80, -45)">
                                        <text fill="#555" fontSize="10" y="-5" fontWeight="bold">TAG</text>
                                        <text fill="#555" fontSize="10" x="55" y="-5" fontWeight="bold">DATA</text>
                                        <text fill="#555" fontSize="10" x="140" y="-5" fontWeight="bold">MESI</text>
                                        <line x1="0" y1="0" x2="160" y2="0" stroke="#222" />
                                    </g>

                                    {/* Cache contents */}
                                    <g transform="translate(-80, -25)">
                                        {Object.keys(cache).length === 0 ? (
                                            <text fill="#333" fontSize="12" dy="40" dx="50">EMPTY</text>
                                        ) : null}
                                        {Object.entries(cache).map(([addr, [val, state]], idx) => (
                                            <g key={addr} transform={`translate(0, ${idx * 28})`}>
                                                <text fill="#888" fontSize="12">{addr}</text>
                                                <text x="55" fill="#e0e0e0" fontSize="12">
                                                    {val.length > 8 ? val.slice(0, 8) + '..' : val}
                                                </text>
                                                <text x="140" fill={
                                                    state === 'M' ? '#ef4444' :
                                                        state === 'E' ? '#22c55e' :
                                                            state === 'S' ? '#3b82f6' : '#6b7280'
                                                } fontWeight="bold" fontSize="12">
                                                    {state}
                                                </text>
                                            </g>
                                        ))}
                                    </g>
                                </g>
                            );
                        })}
                    </svg>

                    {/* Legend Overlay */}
                    <div style={{
                        position: 'absolute', bottom: '20px', left: '20px',
                        background: 'rgba(0,0,0,0.8)', padding: '10px 15px',
                        borderRadius: '8px', border: '1px solid #333',
                        display: 'flex', gap: '15px', backdropFilter: 'blur(4px)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }} /> <span style={{ fontSize: '12px', color: '#ccc' }}>Modified</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 8, height: 8, background: '#22c55e', borderRadius: '50%' }} /> <span style={{ fontSize: '12px', color: '#ccc' }}>Exclusive</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 8, height: 8, background: '#3b82f6', borderRadius: '50%' }} /> <span style={{ fontSize: '12px', color: '#ccc' }}>Shared</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 8, height: 8, background: '#6b7280', borderRadius: '50%' }} /> <span style={{ fontSize: '12px', color: '#ccc' }}>Invalid</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MESISimulator;