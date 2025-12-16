import React, { useState, useEffect } from 'react';

const App = () => {
  const [clock, setClock] = useState(0);
  const [activeTransfers, setActiveTransfers] = useState([]);
  const [highlightedNodes, setHighlightedNodes] = useState({});
  const [logHistory, setLogHistory] = useState([]);

  // 1. MEMORY STATE
  const [objectsInMemory, setObjectsInMemory] = useState({
    "0x100": "Data A",
    "0x104": "Data B",
    "0x108": "Data C"
  });

  // 2. CORE STATE (Started with 4 Cores)
  const [cores, setCores] = useState([
    { "0x100": ["Data F", "M"], "0x104": ["Data G", "I"] }, // Core 0
    { "0x108": ["Data C", "E"] },                            // Core 1
    {},                                                      // Core 2
    {}                                                       // Core 3
  ]);

  // 3. UI STATE
  const [opCore, setOpCore] = useState(0);
  const [opAddr, setOpAddr] = useState("0x100");
  const [opVal, setOpVal] = useState("NewData");

  // --- ANIMATION SYSTEM ---
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const log = (msg) => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    setLogHistory(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 5));
  };

  const animateTransfer = (from, to, data, color = '#ffffff') => {
    const id = Date.now() + Math.random();
    setActiveTransfers(prev => [...prev, { id, from, to, data, color, progress: 0 }]);

    const interval = setInterval(() => {
      setActiveTransfers(prev => {
        const updated = prev.map(t =>
          t.id === id ? { ...t, progress: t.progress + 0.05 } : t
        );
        // Remove finished transfers
        return updated.filter(t => t.progress < 1);
      });
    }, 20);

    setTimeout(() => clearInterval(interval), 400);
  };

  const highlightNode = (node) => {
    setHighlightedNodes(prev => ({ ...prev, [node]: true }));
    setTimeout(() => {
      setHighlightedNodes(prev => ({ ...prev, [node]: false }));
    }, 500);
  };

  // --- POSITIONING LOGIC ---
  const getNodePosition = (type, index = 0) => {
    const CX = 400; // Center X
    const CY = 300; // Center Y
    const R = 220;  // Radius

    if (type === 'memory') return { x: CX, y: 550 };
    if (type === 'bus') return { x: CX, y: CY };

    // 4 Cores in a square layout
    // 0: Top Left, 1: Top Right, 2: Bottom Right, 3: Bottom Left
    const positions = [
      { x: CX - 180, y: CY - 180 },
      { x: CX + 180, y: CY - 180 },
      { x: CX + 180, y: CY + 100 },
      { x: CX - 180, y: CY + 100 },
    ];
    return positions[index] || { x: CX, y: CY };
  };

  // --- MESI LOGIC ---

  const addObjectToMemory = async (memory_address, value) => {
    setObjectsInMemory(prev => ({ ...prev, [memory_address]: value }));
    setClock(prev => prev + 100);
    highlightNode('memory');
    log(`RAM: Written ${value} @ ${memory_address}`);
    await delay(300);
  };

  const readFromMemory = async (memory_address) => {
    setClock(prev => prev + 100);
    highlightNode('memory');
    log(`RAM: Read ${memory_address}`);
    await delay(300);
    return objectsInMemory[memory_address] || "ERR";
  };

  const shareCache = async (memory_address, cache_value, fromCore, toCore) => {
    log(`BUS: Core ${fromCore} -> Core ${toCore}`);
    animateTransfer(`core${fromCore}`, `core${toCore}`, cache_value);
    await delay(400);

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
    log(`BUS: Read Request for ${memory_address}`);
    highlightNode('bus');

    // Visual: Broadcast
    for (let i = 0; i < cores.length; i++) {
      if (i !== from_core_index) animateTransfer('bus', `core${i}`, '?', '#555');
    }
    await delay(300);

    let tempCores = JSON.parse(JSON.stringify(cores));
    let providerFound = false;
    let val = null;

    for (let i = 0; i < tempCores.length; i++) {
      if (i === from_core_index) continue;

      const core = tempCores[i];
      if (core[memory_address]) {
        const [value, state] = core[memory_address];
        if (state === 'I') continue;

        if (state === 'M') {
          log(`BUS: Core ${i} Flush (M->S)`);
          highlightNode(`core${i}`);
          animateTransfer(`core${i}`, 'memory', value, '#fff'); // Flush
          await delay(400);
          await addObjectToMemory(memory_address, value);

          tempCores[i][memory_address][1] = "S";
          await shareCache(memory_address, value, i, from_core_index);
          providerFound = true;
          val = value;
          break;
        }
        else if (state === 'E' || state === 'S') {
          log(`BUS: Core ${i} Shared`);
          if (state === 'E') tempCores[i][memory_address][1] = "S";
          await shareCache(memory_address, value, i, from_core_index);
          providerFound = true;
          val = value;
          break;
        }
      }
    }

    setCores(tempCores);

    if (providerFound) return val;

    // Cache Miss -> RAM
    log(`BUS: Miss. Fetching RAM.`);
    animateTransfer('memory', `core${from_core_index}`, memory_address);
    await delay(400);
    const correct_value = await readFromMemory(memory_address);

    setCores(prev => {
      const c = [...prev];
      c[from_core_index] = { ...c[from_core_index], [memory_address]: [correct_value, "E"] };
      return c;
    });

    return correct_value;
  };

  const kickAllCores = async (memory_address, current_core_index) => {
    log(`BUS: Invalidate ${memory_address}`);
    highlightNode('bus');

    for (let i = 0; i < cores.length; i++) {
      if (i !== current_core_index) {
        animateTransfer('bus', `core${i}`, 'X', '#fff'); // Invalidate signal
      }
    }
    await delay(300);

    setCores(prev => prev.map((core, i) => {
      if (i === current_core_index) return core;
      if (core[memory_address]) {
        return { ...core, [memory_address]: [core[memory_address][0], 'I'] };
      }
      return core;
    }));
    setClock(prev => prev + 1);
  };

  // --- ACTIONS ---

  const handleRead = async () => {
    log(`OP: Core ${opCore} READ ${opAddr}`);
    highlightNode(`core${opCore}`);
    const cache = cores[opCore];

    if (!cache[opAddr] || cache[opAddr][1] === "I") {
      await busRead(opCore, opAddr);
    } else {
      log(`HIT: ${cache[opAddr][1]}`);
      setClock(prev => prev + 1);
    }
  };

  const handleWrite = async () => {
    log(`OP: Core ${opCore} WRITE ${opAddr}`);
    highlightNode(`core${opCore}`);

    let state = cores[opCore][opAddr] ? cores[opCore][opAddr][1] : "I";

    if (state === "S" || state === "I") {
      await kickAllCores(opAddr, opCore);
      state = "E";
    }

    setCores(prev => {
      const newCores = [...prev];
      newCores[opCore] = { ...newCores[opCore], [opAddr]: [opVal, "M"] };
      return newCores;
    });

    setClock(prev => prev + 1);
  };

  // --- RENDER HELPERS ---

  // Minimalist terminal colors
  const stateStyle = (s) => {
    switch (s) {
      case 'M': return { color: '#ff3333', fontWeight: 'bold' }; // Red
      case 'E': return { color: '#33ff33', fontWeight: 'bold' }; // Green
      case 'S': return { color: '#33ffff', fontWeight: 'bold' }; // Cyan
      case 'I': return { color: '#666', fontStyle: 'italic' };   // Grey
      default: return {};
    }
  };

  return (
    <div style={{
      fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
      background: '#000000',
      color: '#e0e0e0',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '40px'
    }}>

      {/* HEADER */}
      <div style={{ borderBottom: '2px solid #333', paddingBottom: '20px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', letterSpacing: '-1px', color: '#fff' }}>MESI PROTOCOL</h1>
          <div style={{ color: '#666', marginTop: '5px' }}>Watch cache coherence in action</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '3rem', lineHeight: '1', fontWeight: 'bold' }}>{clock}</div>
          <div style={{ color: '#444', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Cycles</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '40px' }}>

        {/* LEFT COLUMN: CONTROLS & LOGS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

          {/* CONTROL PANEL */}
          <div style={{ border: '1px solid #333', padding: '20px' }}>
            <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: '15px', textTransform: 'uppercase' }}>Operation</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '10px', flex: 1, fontFamily: 'inherit' }}
                  value={opCore} onChange={e => setOpCore(Number(e.target.value))}
                >
                  {cores.map((_, i) => <option key={i} value={i}>CORE {i}</option>)}
                </select>
                <input
                  style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '10px', width: '80px', fontFamily: 'inherit' }}
                  value={opAddr} onChange={e => setOpAddr(e.target.value)}
                />
              </div>
              <input
                style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '10px', fontFamily: 'inherit' }}
                value={opVal} onChange={e => setOpVal(e.target.value)} placeholder="Value..."
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                <button onClick={handleRead} style={{ background: '#fff', color: '#000', border: 'none', padding: '12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}>READ</button>
                <button onClick={handleWrite} style={{ background: 'transparent', color: '#fff', border: '1px solid #fff', padding: '12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}>WRITE</button>
              </div>
            </div>
          </div>

          {/* LOGS */}
          <div style={{ border: '1px solid #333', padding: '20px', flex: 1, minHeight: '300px' }}>
            <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: '15px', textTransform: 'uppercase' }}>System Log</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              {logHistory.map((l, i) => (
                <div key={i} style={{ borderLeft: i === 0 ? '2px solid #fff' : '2px solid transparent', paddingLeft: '10px', color: i === 0 ? '#fff' : '#666' }}>
                  {l}
                </div>
              ))}
              {logHistory.length === 0 && <span style={{ color: '#333' }}>Waiting for input...</span>}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: VISUALIZATION */}
        <div style={{ position: 'relative', border: '1px solid #333', minHeight: '600px', background: '#050505' }}>
          <svg width="100%" height="100%" viewBox="0 0 800 600">
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="20" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#333" />
              </marker>
            </defs>

            {/* CONNECTING LINES */}
            <g stroke="#222" strokeWidth="2">
              {cores.map((_, i) => {
                const p = getNodePosition('core', i);
                const bus = getNodePosition('bus');
                return <line key={i} x1={p.x} y1={p.y} x2={bus.x} y2={bus.y} />;
              })}
              <line
                x1={getNodePosition('memory').x} y1={getNodePosition('memory').y}
                x2={getNodePosition('bus').x} y2={getNodePosition('bus').y}
              />
            </g>

            {/* ANIMATED PACKETS */}
            {activeTransfers.map(t => {
              const start = getNodePosition(...t.from.split(/(\d+)/));
              const end = getNodePosition(...t.to.split(/(\d+)/));
              const x = start.x + (end.x - start.x) * t.progress;
              const y = start.y + (end.y - start.y) * t.progress;
              return (
                <g key={t.id}>
                  <circle cx={x} cy={y} r="4" fill="#fff" />
                  <text x={x + 8} y={y} fill="#fff" fontSize="10" fontFamily="inherit">{t.data}</text>
                </g>
              );
            })}

            {/* MEMORY NODE */}
            <g transform={`translate(${getNodePosition('memory').x}, ${getNodePosition('memory').y})`}>
              <rect x="-80" y="-30" width="160" height="60" fill="#000" stroke={highlightedNodes['memory'] ? '#fff' : '#333'} strokeWidth="2" />
              <text y="-40" textAnchor="middle" fill="#666" fontSize="10" letterSpacing="2px">MAIN MEMORY</text>
              <g transform="translate(-70, -10)">
                {Object.entries(objectsInMemory).map(([k, v], i) => (
                  <text key={k} y={i * 15} fill="#888" fontSize="10" fontFamily="inherit">
                    {k}: <tspan fill="#fff">{v}</tspan>
                  </text>
                ))}
              </g>
            </g>

            {/* BUS NODE */}
            <g transform={`translate(${getNodePosition('bus').x}, ${getNodePosition('bus').y})`}>
              <circle r="40" fill="#000" stroke={highlightedNodes['bus'] ? '#fff' : '#333'} strokeWidth="2" />
              <text dy="5" textAnchor="middle" fill="#666" fontSize="12" letterSpacing="1px">BUS</text>
            </g>

            {/* CORE NODES */}
            {cores.map((cache, i) => {
              const pos = getNodePosition('core', i);
              const isHighlight = highlightedNodes[`core${i}`];
              return (
                <g key={i} transform={`translate(${pos.x}, ${pos.y})`}>
                  {/* Core Box */}
                  <rect
                    x="-70" y="-60" width="140" height="120"
                    fill="#000"
                    stroke={isHighlight ? '#fff' : '#333'}
                    strokeWidth={isHighlight ? 2 : 1}
                  />

                  {/* Label */}
                  <text y="-75" x="-70" fill="#666" fontSize="10" letterSpacing="1px">CORE {i}</text>

                  {/* Cache Lines */}
                  <g transform="translate(-60, -35)">
                    {Object.keys(cache).length === 0 ? <text fill="#333" fontSize="10">EMPTY</text> : null}
                    {Object.entries(cache).map(([addr, [val, state]], idx) => (
                      <g key={addr} transform={`translate(0, ${idx * 20})`}>
                        <text fill="#888" fontSize="10">{addr}</text>
                        <text x="45" fill="#ccc" fontSize="10">{val}</text>
                        <text x="110" style={stateStyle(state)} fontSize="10">{state}</text>
                        <line x1="0" y1="12" x2="120" y2="12" stroke="#111" />
                      </g>
                    ))}
                  </g>
                </g>
              );
            })}

          </svg>
        </div>

      </div>
    </div>
  );
};

export default App;