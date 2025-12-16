import React, { useState, useRef, useEffect } from 'react';

const App = () => {
  const [clock, setClock] = useState(0);
  const [activeTransfers, setActiveTransfers] = useState([]);
  const [highlightedNodes, setHighlightedNodes] = useState({});

  const [objectsInMemory, setObjectsInMemory] = useState({
    "0x100": "Data A",
    "0x104": "Data B",
    "0x108": "Data C"
  });

  const [cores, setCores] = useState([
    { "0x100": ["Data F", "M"], "0x104": ["Data G", "I"] },
    { "0x108": ["Data C", "E"] }
  ]);

  const [opCore, setOpCore] = useState(0);
  const [opAddr, setOpAddr] = useState("0x100");
  const [opVal, setOpVal] = useState("NewData");
  const [currentLog, setCurrentLog] = useState("System ready");

  // Animation helpers
  const animateTransfer = (from, to, data, color = '#61dafb') => {
    const id = Date.now() + Math.random();
    setActiveTransfers(prev => [...prev, { id, from, to, data, color, progress: 0 }]);

    const interval = setInterval(() => {
      setActiveTransfers(prev => {
        const updated = prev.map(t =>
          t.id === id ? { ...t, progress: t.progress + 0.05 } : t
        );
        return updated.filter(t => t.progress < 1);
      });
    }, 30);

    setTimeout(() => clearInterval(interval), 600);
  };

  const highlightNode = (node, duration = 1000) => {
    setHighlightedNodes(prev => ({ ...prev, [node]: true }));
    setTimeout(() => {
      setHighlightedNodes(prev => ({ ...prev, [node]: false }));
    }, duration);
  };

  const log = (msg) => {
    setCurrentLog(msg);
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Core positions for visualization
  const getNodePosition = (type, index = 0) => {
    if (type === 'memory') return { x: 400, y: 50 };
    if (type === 'bus') return { x: 400, y: 250 };

    // Arrange cores in a circle around the bus
    const numCores = cores.length;
    const radius = 200;
    const angle = (index / numCores) * 2 * Math.PI - Math.PI / 2;
    return {
      x: 400 + radius * Math.cos(angle),
      y: 250 + radius * Math.sin(angle)
    };
  };

  // MESI Operations
  const addObjectToMemory = async (memory_address, value) => {
    setObjectsInMemory(prev => ({ ...prev, [memory_address]: value }));
    setClock(prev => prev + 100);
    highlightNode('memory', 1500);
    log(`Added ${value} to memory at ${memory_address}`);
    await delay(300);
  };

  const readFromMemory = async (memory_address) => {
    setClock(prev => prev + 100);
    highlightNode('memory', 1000);
    log(`Reading from memory: ${memory_address}`);
    await delay(300);
    return objectsInMemory[memory_address] || "ERROR";
  };

  const shareCache = async (memory_address, cache_value, fromCore, toCore) => {
    log(`Core ${fromCore} sharing to Core ${toCore}`);
    animateTransfer(`core${fromCore}`, `core${toCore}`, cache_value, '#4ade80');
    await delay(600);
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
    log(`Core ${from_core_index} broadcasting on bus for ${memory_address}`);
    highlightNode('bus', 2000);

    // Animate broadcast to all cores
    for (let i = 0; i < cores.length; i++) {
      if (i !== from_core_index) {
        animateTransfer('bus', `core${i}`, 'snoop', '#fbbf24');
      }
    }
    await delay(300);

    let tempCores = JSON.parse(JSON.stringify(cores));

    for (let i = 0; i < tempCores.length; i++) {
      setClock(prev => prev + 1);

      if (i === from_core_index) continue;

      const core = tempCores[i];
      if (core[memory_address]) {
        const [value, state] = core[memory_address];

        if (state === 'I') continue;

        if (state === 'M') {
          log(`Core ${i} has modified data - writing back to memory`);
          highlightNode(`core${i}`, 1000);
          animateTransfer(`core${i}`, 'memory', value, '#ef4444');
          await delay(600);
          await addObjectToMemory(memory_address, value);

          tempCores[i][memory_address][1] = "S";
          await shareCache(memory_address, value, i, from_core_index);
          setCores(tempCores);
          return value;
        }
        else if (state === 'E' || state === 'S') {
          log(`Core ${i} sharing (${state} state)`);
          highlightNode(`core${i}`, 1000);
          if (state === 'E') tempCores[i][memory_address][1] = "S";
          await shareCache(memory_address, value, i, from_core_index);
          setCores(tempCores);
          return value;
        }
      }
    }

    setCores(tempCores);

    // Not found in caches - fetch from memory
    log(`Cache miss - fetching from memory`);
    animateTransfer('memory', `core${from_core_index}`, memory_address, '#61dafb');
    await delay(600);
    const correct_value = await readFromMemory(memory_address);

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
    log(`Broadcasting invalidation for ${memory_address}`);
    highlightNode('bus', 1500);

    for (let i = 0; i < cores.length; i++) {
      if (i !== current_core_index && cores[i][memory_address]) {
        animateTransfer('bus', `core${i}`, 'invalidate', '#ef4444');
        highlightNode(`core${i}`, 800);
      }
    }
    await delay(600);

    setCores(prev => {
      const newCores = prev.map((core, i) => {
        if (i === current_core_index) return core;
        if (core[memory_address]) {
          const newCore = { ...core };
          newCore[memory_address] = [newCore[memory_address][0], 'I'];
          return newCore;
        }
        return core;
      });
      return newCores;
    });
    setClock(prev => prev + 1);
  };

  const handleRead = async () => {
    log(`READ operation: Core ${opCore}, Address ${opAddr}`);
    highlightNode(`core${opCore}`, 2000);
    const current_core_cache = cores[opCore];

    if (!current_core_cache[opAddr] || current_core_cache[opAddr][1] === "I") {
      log("Cache miss or invalid - initiating bus read");
      await busRead(opCore, opAddr);
      return;
    }

    const [current_value, current_state] = current_core_cache[opAddr];
    if (["M", "E", "S"].includes(current_state)) {
      log(`Cache hit! State: ${current_state}, Value: ${current_value}`);
      setClock(prev => prev + 1);
    }
  };

  const handleWrite = async () => {
    log(`WRITE operation: Core ${opCore}, Address ${opAddr} = ${opVal}`);
    highlightNode(`core${opCore}`, 2000);

    let state = cores[opCore][opAddr] ? cores[opCore][opAddr][1] : "I";

    if (state === "S" || state === "I") {
      log(`State ${state} - invalidating other caches`);
      await kickAllCores(opAddr, opCore);
      state = "E";
    }

    setCores(prev => {
      const newCores = [...prev];
      if (state === "E" || state === "M") {
        newCores[opCore][opAddr] = [opVal, "M"];
      }
      return newCores;
    });

    setClock(prev => prev + 1);
    log(`Write complete - Core ${opCore} now in M state`);
  };

  // Render animated transfer lines
  const renderTransfers = () => {
    return activeTransfers.map(transfer => {
      const fromPos = getNodePosition(...transfer.from.split(/(\d+)/));
      const toPos = getNodePosition(...transfer.to.split(/(\d+)/));

      const x = fromPos.x + (toPos.x - fromPos.x) * transfer.progress;
      const y = fromPos.y + (toPos.y - fromPos.y) * transfer.progress;

      return (
        <g key={transfer.id}>
          <line
            x1={fromPos.x}
            y1={fromPos.y}
            x2={toPos.x}
            y2={toPos.y}
            stroke={transfer.color}
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.4"
          />
          <circle
            cx={x}
            cy={y}
            r="6"
            fill={transfer.color}
            opacity="0.8"
          />
          <text
            x={x}
            y={y - 12}
            fill={transfer.color}
            fontSize="10"
            textAnchor="middle"
            fontWeight="bold"
          >
            {transfer.data}
          </text>
        </g>
      );
    });
  };

  const stateColors = {
    M: '#ef4444',
    E: '#22c55e',
    S: '#3b82f6',
    I: '#6b7280'
  };

  return (
    <div style={{ fontFamily: 'system-ui', padding: '20px', background: '#0f172a', minHeight: '100vh', color: 'white' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0, color: '#61dafb' }}>MESI Protocol Visualizer</h1>
            <p style={{ margin: '5px 0', color: '#94a3b8' }}>Watch cache coherence in action</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#61dafb' }}>{clock}</div>
            <div style={{ fontSize: '0.9em', color: '#94a3b8' }}>Clock Cycles</div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'end', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.9em' }}>Core</label>
              <select
                value={opCore}
                onChange={e => setOpCore(Number(e.target.value))}
                style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: 'white' }}
              >
                {cores.map((_, i) => <option key={i} value={i}>Core {i}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.9em' }}>Address</label>
              <input
                value={opAddr}
                onChange={e => setOpAddr(e.target.value)}
                style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: 'white' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.9em' }}>Value (Write)</label>
              <input
                value={opVal}
                onChange={e => setOpVal(e.target.value)}
                style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: 'white' }}
              />
            </div>
            <button onClick={handleRead} style={{ padding: '8px 24px', background: '#3b82f6', border: 'none', borderRadius: '6px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
              READ
            </button>
            <button onClick={handleWrite} style={{ padding: '8px 24px', background: '#ef4444', border: 'none', borderRadius: '6px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
              WRITE
            </button>
          </div>

          <div style={{ padding: '12px', background: '#0f172a', borderRadius: '6px', borderLeft: '3px solid #61dafb' }}>
            <div style={{ fontSize: '0.85em', color: '#94a3b8' }}>System Status:</div>
            <div style={{ fontSize: '0.95em', marginTop: '4px' }}>{currentLog}</div>
          </div>
        </div>

        {/* Visual Graph */}
        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <svg width="800" height="500" style={{ display: 'block', margin: '0 auto' }}>
            {/* Connection lines */}
            <g opacity="0.3">
              {cores.map((_, i) => {
                const corePos = getNodePosition('core', i);
                const busPos = getNodePosition('bus');
                return (
                  <line
                    key={`bus-line-${i}`}
                    x1={corePos.x}
                    y1={corePos.y}
                    x2={busPos.x}
                    y2={busPos.y}
                    stroke="#475569"
                    strokeWidth="2"
                  />
                );
              })}
              <line
                x1={getNodePosition('memory').x}
                y1={getNodePosition('memory').y}
                x2={getNodePosition('bus').x}
                y2={getNodePosition('bus').y}
                stroke="#475569"
                strokeWidth="2"
              />
            </g>

            {/* Animated transfers */}
            {renderTransfers()}

            {/* Memory */}
            <g>
              <rect
                x={getNodePosition('memory').x - 60}
                y={getNodePosition('memory').y - 25}
                width="120"
                height="50"
                rx="8"
                fill={highlightedNodes['memory'] ? '#1e40af' : '#1e293b'}
                stroke="#61dafb"
                strokeWidth="3"
              />
              <text x={getNodePosition('memory').x} y={getNodePosition('memory').y + 5} textAnchor="middle" fill="white" fontWeight="bold">
                MEMORY
              </text>
            </g>

            {/* Bus */}
            <g>
              <rect
                x={getNodePosition('bus').x - 50}
                y={getNodePosition('bus').y - 20}
                width="100"
                height="40"
                rx="6"
                fill={highlightedNodes['bus'] ? '#7c3aed' : '#1e293b'}
                stroke="#a78bfa"
                strokeWidth="2"
              />
              <text x={getNodePosition('bus').x} y={getNodePosition('bus').y + 5} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
                BUS
              </text>
            </g>

            {/* Cores */}
            {cores.map((cache, i) => {
              const pos = getNodePosition('core', i);
              const cacheLines = Object.entries(cache);

              return (
                <g key={i}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="50"
                    fill={highlightedNodes[`core${i}`] ? '#1e40af' : '#1e293b'}
                    stroke="#3b82f6"
                    strokeWidth="3"
                  />
                  <text x={pos.x} y={pos.y - 20} textAnchor="middle" fill="white" fontWeight="bold" fontSize="14">
                    Core {i}
                  </text>

                  {cacheLines.slice(0, 2).map(([addr, [val, state]], idx) => (
                    <text key={addr} x={pos.x} y={pos.y + idx * 15} textAnchor="middle" fontSize="10" fill={stateColors[state]}>
                      {addr}: {state}
                    </text>
                  ))}
                  {cacheLines.length > 2 && (
                    <text x={pos.x} y={pos.y + 30} textAnchor="middle" fontSize="9" fill="#94a3b8">
                      +{cacheLines.length - 2} more
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* State Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          {/* Memory Details */}
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '15px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#61dafb' }}>Memory Contents</h3>
            {Object.entries(objectsInMemory).map(([addr, val]) => (
              <div key={addr} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#0f172a', marginBottom: '5px', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>{addr}</span>
                <span>{val}</span>
              </div>
            ))}
          </div>

          {/* Cache Details */}
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '15px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#3b82f6' }}>Cache States</h3>
            {cores.map((cache, i) => (
              <div key={i} style={{ marginBottom: '15px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#94a3b8' }}>Core {i}</div>
                {Object.entries(cache).map(([addr, [val, state]]) => (
                  <div key={addr} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px', background: '#0f172a', marginBottom: '3px', borderRadius: '4px', fontSize: '0.9em' }}>
                    <span style={{ color: '#94a3b8' }}>{addr}</span>
                    <span>{val}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: stateColors[state], fontSize: '0.85em', fontWeight: 'bold' }}>
                      {state}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ marginTop: '20px', padding: '15px', background: '#1e293b', borderRadius: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>MESI States</div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', background: '#ef4444', borderRadius: '4px' }}></div>
              <span>Modified (M) - Exclusive & Dirty</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', background: '#22c55e', borderRadius: '4px' }}></div>
              <span>Exclusive (E) - Exclusive & Clean</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', background: '#3b82f6', borderRadius: '4px' }}></div>
              <span>Shared (S) - Clean Copy</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', background: '#6b7280', borderRadius: '4px' }}></div>
              <span>Invalid (I) - Not Valid</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;