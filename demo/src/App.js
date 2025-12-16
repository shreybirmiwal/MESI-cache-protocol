import React, { useState, useRef } from 'react';

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

  // REF FIX: Keeps track of logs instantly, bypassing the "Stale State" issue in async functions
  const currentActionRef = useRef([]);

  // --- Animation Constants (Slowed down 100%) ---
  const STEP_DELAY = 1200;
  const LONG_DELAY = 1600;
  const TRANSFER_SPEED = 0.01;
  const TRANSFER_DURATION = 3000;

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Modified to use Ref for persistence and State for UI rendering
  const addToCurrentAction = (msg) => {
    currentActionRef.current = [...currentActionRef.current, msg];
    setCurrentAction([...currentActionRef.current]);
  };

  const finalizeAction = (command) => {
    // Grab the steps from the Ref to ensure we have the LATEST data
    const stepsToSave = [...currentActionRef.current];

    setActionHistory(prev => [{
      command,
      steps: stepsToSave,
      timestamp: new Date().toLocaleTimeString([], { hour12: false })
    }, ...prev].slice(0, 20));

    // Reset both Ref and State
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
        return updated.filter(t => t.progress < 1);
      });
    }, 30);

    setTimeout(() => clearInterval(interval), TRANSFER_DURATION);
  };

  const highlightNode = (node, duration = 2000) => {
    setHighlightedNodes(prev => ({ ...prev, [node]: true }));
    setTimeout(() => {
      setHighlightedNodes(prev => ({ ...prev, [node]: false }));
    }, duration);
  };

  // Node positioning
  const getNodePosition = (type, index = 0) => {
    const CX = 400;
    const CY = 300;

    if (type === 'memory') return { x: CX, y: 550 };
    if (type === 'bus') return { x: CX, y: CY };

    const positions = [
      { x: CX - 200, y: CY - 180 },
      { x: CX + 200, y: CY - 180 },
      { x: CX + 200, y: CY + 100 },
      { x: CX - 200, y: CY + 100 },
    ];
    return positions[index] || { x: CX, y: CY };
  };

  // --- MESI Logic ---

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
    addToCurrentAction(`[BUS] Core ${fromCore} sharing to Core ${toCore}`);
    animateTransfer(`core${fromCore}`, `core${toCore}`, cache_value, '#4ade80');
    await delay(LONG_DELAY);

    setClock(prev => prev + 5);

    setCores(prev => {
      const newCores = [...prev];
      newCores[toCore] = {
        ...newCores[toCore],
        [memory_address]: [cache_value, "S"]
      };
      return newCores;
    });
  };

  const busRead = async (from_core_index, memory_address) => {
    addToCurrentAction(`[BUS] Core ${from_core_index} requesting ${memory_address}`);
    highlightNode('bus', 2500);

    for (let i = 0; i < cores.length; i++) {
      if (i !== from_core_index) {
        animateTransfer('bus', `core${i}`, '?', '#fbbf24');
      }
    }
    await delay(STEP_DELAY);

    let tempCores = JSON.parse(JSON.stringify(cores));
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
          addToCurrentAction(`[HIT] Core ${i} has modified data (M)`);
          addToCurrentAction(`[BUS] Core ${i} writes back to memory`);
          addToCurrentAction(`[STATE] Core ${i} downgrades M > S`);

          highlightNode(`core${i}`, LONG_DELAY);
          animateTransfer(`core${i}`, 'memory', value, '#ef4444');
          await delay(LONG_DELAY);

          await addObjectToMemory(memory_address, value);
          tempCores[i][memory_address][1] = "S";

          foundValue = value;
          foundInCore = i;
          break;
        }
        else if (state === 'E') {
          addToCurrentAction(`[HIT] Core ${i} has exclusive data (E)`);
          addToCurrentAction(`[STATE] Core ${i} downgrades E > S`);

          highlightNode(`core${i}`, LONG_DELAY);
          tempCores[i][memory_address][1] = "S";

          foundValue = value;
          foundInCore = i;
          break;
        }
        else if (state === 'S') {
          addToCurrentAction(`[HIT] Core ${i} already has shared copy`);

          highlightNode(`core${i}`, LONG_DELAY);

          foundValue = value;
          foundInCore = i;
          break;
        }
      }
    }

    setCores(tempCores);

    if (foundValue !== null) {
      addToCurrentAction(`[BUS] Core ${from_core_index} receives data`);
      await shareCache(memory_address, foundValue, foundInCore, from_core_index);
      return foundValue;
    }

    addToCurrentAction(`[MISS] No core has the data`);
    addToCurrentAction(`[MEM] Fetching from main memory`);

    animateTransfer('memory', `core${from_core_index}`, memory_address, '#3b82f6');
    await delay(LONG_DELAY);

    const correct_value = await readFromMemory(memory_address);

    addToCurrentAction(`[STATE] Core ${from_core_index} set to Exclusive (E)`);
    setCores(prev => {
      const c = [...prev];
      c[from_core_index] = {
        ...c[from_core_index],
        [memory_address]: [correct_value, "E"]
      };
      return c;
    });

    return correct_value;
  };

  const kickAllCores = async (memory_address, current_core_index) => {
    addToCurrentAction(`[BUS] Broadcasting invalidation for ${memory_address}`);
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

  // --- Handlers ---

  const handleRead = async () => {
    // Reset Ref before starting
    currentActionRef.current = [];
    const command = `READ: Core ${opCore} -> ${opAddr}`;
    addToCurrentAction(`[CMD] ${command}`);

    highlightNode(`core${opCore}`, 2000);

    const cache = cores[opCore];

    if (!cache[opAddr] || cache[opAddr][1] === "I") {
      addToCurrentAction(`[MISS] Cache miss or invalid state`);
      await delay(STEP_DELAY);
      await busRead(opCore, opAddr);
    } else {
      const [val, state] = cache[opAddr];
      addToCurrentAction(`[HIT] Cache HIT! State: ${state}`);
      addToCurrentAction(`[VAL] Value: ${val}`);
      addToCurrentAction(`[LOC] Reading from local cache (1 cycle)`);

      setClock(prev => prev + 1);
    }

    finalizeAction(command);
  };

  const handleWrite = async () => {
    // Reset Ref before starting
    currentActionRef.current = [];
    const command = `WRITE: Core ${opCore} -> ${opAddr} = ${opVal}`;
    addToCurrentAction(`[CMD] ${command}`);

    highlightNode(`core${opCore}`, 2000);

    let state = cores[opCore][opAddr] ? cores[opCore][opAddr][1] : "I";

    if (state === "S" || state === "I") {
      addToCurrentAction(`[BUS] Current state: ${state} (need exclusive)`);
      await delay(STEP_DELAY);
      await kickAllCores(opAddr, opCore);
      state = "E";
    }

    addToCurrentAction(`[WRT] Writing value: ${opVal}`);
    addToCurrentAction(`[STATE] Transitioning to Modified (M)`);

    setCores(prev => {
      const newCores = [...prev];
      newCores[opCore] = {
        ...newCores[opCore],
        [opAddr]: [opVal, "M"]
      };
      return newCores;
    });

    setClock(prev => prev + 1);

    finalizeAction(command);
  };

  // --- Styling Constants ---
  const stateColors = {
    M: '#ef4444', // Red
    E: '#22c55e', // Green
    S: '#3b82f6', // Blue
    I: '#6b7280'  // Gray
  };

  const stateStyle = (s) => ({
    fill: stateColors[s],
    fontWeight: 'bold',
    fontSize: '14px'
  });

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      background: '#0a0a0a',
      color: '#e0e0e0',
      minHeight: '100vh',
      padding: '40px',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid #333',
        paddingBottom: '20px',
        marginBottom: '30px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '600', color: '#fff' }}>
            MESI Protocol Simulator
          </h1>
          <a
            href="https://github.com/shreybirmiwal/MESI-cache-protocol"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#4ade80',
              textDecoration: 'none',
              fontSize: '0.9rem',
              marginTop: '5px',
              display: 'inline-block'
            }}
          >
            View on GitHub →
          </a>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '2.5rem', lineHeight: '1', fontWeight: '700', fontFamily: 'monospace' }}>{clock}</div>
          <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Cycles
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '40px' }}>
        {/* Left Panel: Controls & Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Controls */}
          <div style={{ background: '#111', border: '1px solid #333', padding: '20px', borderRadius: '8px' }}>
            <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '15px', textTransform: 'uppercase', fontWeight: '600' }}>
              Core Operation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  style={{
                    background: '#222',
                    color: '#fff',
                    border: '1px solid #444',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    flex: 1,
                    fontSize: '0.9rem'
                  }}
                  value={opCore}
                  onChange={e => setOpCore(Number(e.target.value))}
                >
                  {cores.map((_, i) => <option key={i} value={i}>Core {i}</option>)}
                </select>
                <input
                  style={{
                    background: '#222',
                    color: '#fff',
                    border: '1px solid #444',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    width: '80px',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace'
                  }}
                  value={opAddr}
                  onChange={e => setOpAddr(e.target.value)}
                />
              </div>
              <input
                style={{
                  background: '#222',
                  color: '#fff',
                  border: '1px solid #444',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '0.9rem'
                }}
                value={opVal}
                onChange={e => setOpVal(e.target.value)}
                placeholder="Value..."
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '5px' }}>
                <button
                  onClick={handleRead}
                  disabled={currentAction !== null}
                  style={{
                    background: '#fff',
                    color: '#000',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '4px',
                    cursor: currentAction ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: currentAction ? 0.5 : 1
                  }}
                >
                  READ
                </button>
                <button
                  onClick={handleWrite}
                  disabled={currentAction !== null}
                  style={{
                    background: 'transparent',
                    color: '#fff',
                    border: '1px solid #fff',
                    padding: '10px',
                    borderRadius: '4px',
                    cursor: currentAction ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: currentAction ? 0.5 : 1
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
            border: '1px solid #333',
            borderRadius: '8px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            maxHeight: '600px'
          }}>
            <div style={{
              padding: '15px',
              borderBottom: '1px solid #333',
              color: '#888',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              System Log
            </div>

            <div style={{
              padding: '15px',
              overflowY: 'auto',
              fontFamily: 'Menlo, Monaco, Consolas, monospace',
              fontSize: '0.85rem'
            }}>
              {/* Active Action */}
              {currentAction && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ color: '#4ade80', marginBottom: '8px', fontWeight: 'bold' }}>
                    &gt; Executing...
                  </div>
                  {currentAction.map((step, i) => (
                    <div key={i} style={{
                      paddingLeft: '12px',
                      borderLeft: '2px solid #4ade80',
                      marginBottom: '4px',
                      color: '#fff'
                    }}>
                      {step}
                    </div>
                  ))}
                </div>
              )}

              {/* History */}
              {actionHistory.map((action, idx) => (
                <div key={idx} style={{
                  marginBottom: '20px',
                  borderLeft: '2px solid #333',
                  paddingLeft: '12px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#666',
                    fontSize: '0.75rem',
                    marginBottom: '4px'
                  }}>
                    <span>{action.timestamp}</span>
                  </div>
                  <div style={{
                    color: '#4ade80',
                    fontWeight: 'bold',
                    marginBottom: '4px',
                    paddingBottom: '4px'
                  }}>
                    {action.command}
                  </div>
                  {/* Render ALL steps fully visible */}
                  {action.steps.map((step, i) => (
                    <div key={i} style={{
                      marginBottom: '2px',
                      color: '#ddd'
                    }}>
                      {step}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Visualization */}
        <div style={{
          position: 'relative',
          border: '1px solid #333',
          borderRadius: '8px',
          background: '#000',
          fontFamily: 'Menlo, Monaco, Consolas, monospace'
        }}>
          <svg width="100%" height="100%" viewBox="0 0 800 600">
            {/* Connection lines */}
            <g stroke="#333" strokeWidth="2">
              {cores.map((_, i) => {
                const p = getNodePosition('core', i);
                const bus = getNodePosition('bus');
                return <line key={i} x1={p.x} y1={p.y} x2={bus.x} y2={bus.y} />;
              })}
              <line
                x1={getNodePosition('memory').x}
                y1={getNodePosition('memory').y}
                x2={getNodePosition('bus').x}
                y2={getNodePosition('bus').y}
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
                  <circle cx={x} cy={y} r="6" fill={t.color} stroke="#000" strokeWidth="2" />
                  <text
                    x={x + 12}
                    y={y + 4}
                    fill={t.color}
                    fontSize="12"
                    fontWeight="bold"
                  >
                    {t.data}
                  </text>
                </g>
              );
            })}

            {/* Main Memory */}
            <g transform={`translate(${getNodePosition('memory').x}, ${getNodePosition('memory').y})`}>
              <rect
                x="-90"
                y="-40"
                width="180"
                height="80"
                fill="#111"
                rx="4"
                stroke={highlightedNodes['memory'] ? '#fff' : '#333'}
                strokeWidth={highlightedNodes['memory'] ? 2 : 1}
              />
              <text y="-50" textAnchor="middle" fill="#666" fontSize="12" letterSpacing="1px" fontWeight="bold">
                MAIN MEMORY
              </text>
              <g transform="translate(-80, -15)" fontSize="11">
                {Object.entries(objectsInMemory).map(([k, v], i) => (
                  <text key={k} y={i * 20} fill="#888">
                    {k}: <tspan fill="#ccc">{v}</tspan>
                  </text>
                ))}
              </g>
            </g>

            {/* Bus */}
            <g transform={`translate(${getNodePosition('bus').x}, ${getNodePosition('bus').y})`}>
              <circle
                r="40"
                fill="#111"
                stroke={highlightedNodes['bus'] ? '#fff' : '#333'}
                strokeWidth={highlightedNodes['bus'] ? 2 : 1}
              />
              <text dy="5" textAnchor="middle" fill="#888" fontSize="12" fontWeight="bold">
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
                    rx="4"
                    stroke={isHighlight ? '#fff' : '#333'}
                    strokeWidth={isHighlight ? 2 : 1}
                  />
                  <text y="-80" x="-90" fill="#666" fontSize="12" letterSpacing="1px" fontWeight="bold">
                    CORE {i}
                  </text>

                  {/* Cache Table Header */}
                  <g transform="translate(-80, -45)">
                    <text fill="#444" fontSize="10" y="-5">TAG</text>
                    <text fill="#444" fontSize="10" x="50" y="-5">DATA</text>
                    <text fill="#444" fontSize="10" x="140" y="-5">MESI</text>
                    <line x1="0" y1="0" x2="160" y2="0" stroke="#222" />
                  </g>

                  {/* Cache contents */}
                  <g transform="translate(-80, -30)">
                    {Object.keys(cache).length === 0 ? (
                      <text fill="#333" fontSize="12" dy="40" dx="40">EMPTY</text>
                    ) : null}
                    {Object.entries(cache).map(([addr, [val, state]], idx) => (
                      <g key={addr} transform={`translate(0, ${idx * 25})`}>
                        <text fill="#888" fontSize="11">{addr}</text>
                        <text x="50" fill="#ccc" fontSize="11">
                          {val.length > 8 ? val.slice(0, 8) + '..' : val}
                        </text>
                        <text x="140" style={stateStyle(state)}>
                          {state}
                        </text>
                      </g>
                    ))}
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px', display: 'flex', gap: '40px', color: '#888', fontSize: '0.85rem' }}>
        {Object.entries(stateColors).map(([state, color]) => (
          <div key={state} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: color, fontWeight: 'bold', fontSize: '1.2rem' }}>{state}</span>
            <span>
              {state === 'M' && 'Modified'}
              {state === 'E' && 'Exclusive'}
              {state === 'S' && 'Shared'}
              {state === 'I' && 'Invalid'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MESISimulator;