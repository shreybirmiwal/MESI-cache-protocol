import React, { useState, useEffect, useRef } from 'react';

// --- STYLES ---
const styles = {
  container: { fontFamily: 'Consolas, Monaco, monospace', padding: '20px', background: '#1e1e1e', color: '#ccc', minHeight: '100vh', boxSizing: 'border-box' },
  header: { borderBottom: '1px solid #444', marginBottom: '20px', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, color: '#61dafb' },
  grid: { display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' },
  card: { background: '#252526', border: '1px solid #333', borderRadius: '6px', padding: '15px', minWidth: '300px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' },
  sectionTitle: { color: '#dcdcaa', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '5px' },
  row: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #333' },
  inputGroup: { marginBottom: '10px', display: 'flex', gap: '5px' },
  input: { background: '#3c3c3c', border: '1px solid #555', color: 'white', padding: '5px', borderRadius: '3px', flex: 1 },
  button: { background: '#0e639c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' },
  logWindow: { height: '200px', overflowY: 'auto', background: '#111', border: '1px solid #444', padding: '10px', fontFamily: 'monospace', fontSize: '0.85rem' },
  logLine: { marginBottom: '4px' },

  // State badges
  badge: { padding: '2px 6px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 'bold', minWidth: '20px', textAlign: 'center' },
  stateM: { background: '#f03e3e', color: 'white' }, // Modified = Red
  stateE: { background: '#37b24d', color: 'white' }, // Exclusive = Green
  stateS: { background: '#1c7ed6', color: 'white' }, // Shared = Blue
  stateI: { background: '#495057', color: '#adb5bd' }, // Invalid = Gray
};

const StateBadge = ({ state }) => {
  let style = styles.stateI;
  if (state === 'M') style = styles.stateM;
  if (state === 'E') style = styles.stateE;
  if (state === 'S') style = styles.stateS;
  return <span style={{ ...styles.badge, ...style }}>{state}</span>;
};

export default function MESISimulator() {
  // --- STATE ---
  const [clock, setClock] = useState(0);
  const [logs, setLogs] = useState([]);

  // Memory
  const [objectsInMemory, setObjectsInMemory] = useState({
    "0x100": "Data A",
    "0x104": "Data B",
    "0x108": "Data C"
  });

  // Cores
  const [cores, setCores] = useState([
    { "0x100": ["Data F", "M"], "0x104": ["Data G", "I"] }, // Core 0
    { "0x108": ["Data C", "E"] }                            // Core 1
  ]);

  // UI Inputs
  const [opCore, setOpCore] = useState(0);
  const [opAddr, setOpAddr] = useState("0x100");
  const [opVal, setOpVal] = useState("NewData");

  const [newMemAddr, setNewMemAddr] = useState("0x10C");
  const [newMemVal, setNewMemVal] = useState("Data D");

  const logEndRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // --- LOGIC PORT (Exact copy of your Python logic structure) ---

  const addLog = (msg) => {
    setLogs(prev => [...prev, `[Clock ${clock}] ${msg}`]);
  };

  const advanceClock = (amount, msg) => {
    setClock(prev => prev + amount);
    if (msg) addLog(msg);
  };

  // 1. Add Object To Memory
  const addObjectToMemory = (memory_address, value) => {
    setObjectsInMemory(prev => ({ ...prev, [memory_address]: value }));
    advanceClock(100, `MEM: Added ${value} at ${memory_address}`);
  };

  // 2. Read From Memory
  const readFromMemory = (memory_address) => {
    advanceClock(100, "MEM: Reading from memory...");
    if (objectsInMemory[memory_address]) {
      return objectsInMemory[memory_address];
    } else {
      addLog(`ERROR: Address ${memory_address} not found in RAM`);
      return "ERROR";
    }
  };

  // 3. Share Cache
  const share_cache = (memory_address, cache_value, share_to_core_index) => {
    addLog(`BUS: Sharing cache to Core ${share_to_core_index}`);
    advanceClock(5, "BUS: Sharing delay");

    setCores(prev => {
      const newCores = [...prev];
      newCores[share_to_core_index] = {
        ...newCores[share_to_core_index],
        [memory_address]: [cache_value, "S"]
      };
      return newCores;
    });
  };

  // 4. Bus Read
  const bus_read = (from_core_index, memory_address) => {
    addLog(`BUS: Core ${from_core_index} snooping for ${memory_address}`);

    // We need to access the LATEST state of cores/memory here. 
    // In React, we must be careful not to read stale closures. 
    // We will use a functional update pattern or read from a ref if needed. 
    // For this simulation step, we will iterate the 'cores' state directly 
    // but we must construct the 'next' state carefully.

    let foundValue = null;
    let foundInCache = false;

    // Use a temp variable to track updates so we can set state once at the end
    let tempCores = JSON.parse(JSON.stringify(cores)); // Deep copy to mutate safely

    for (let i = 0; i < tempCores.length; i++) {
      advanceClock(1, "BUS: Snooping...");

      if (i === from_core_index) continue; // ignore own core

      const core = tempCores[i];
      if (core[memory_address]) {
        const [value, state] = core[memory_address];

        if (state === 'I') continue;

        if (state === 'M') {
          // core has modified, write to main memory
          addObjectToMemory(memory_address, value); // Note: This is async in React, might show visually after

          core[memory_address][1] = "S"; // downgrade
          addLog(`BUS: Core ${i} sharing (was M)`);
          share_cache(memory_address, value, from_core_index);
          // Note: share_cache updates state asynchronously. 
          // For visualization purposes we return the value here.
          foundValue = value;
          foundInCache = true;
          // In your python code you return immediately.
          break;
        }
        else if (state === 'E') {
          core[memory_address][1] = "S"; // downgrade
          addLog(`BUS: Core ${i} sharing (was E)`);
          share_cache(memory_address, value, from_core_index);
          foundValue = value;
          foundInCache = true;
          break;
        }
        else if (state === 'S') {
          addLog(`BUS: Core ${i} sharing (was S)`);
          share_cache(memory_address, value, from_core_index);
          foundValue = value;
          foundInCache = true;
          break;
        }
      }
    }

    // Update the cores state with any downgrades (M->S, E->S)
    setCores(tempCores);

    if (foundInCache) return foundValue;

    // Not found in caches, read from memory
    const correct_value = readFromMemory(memory_address);

    // Update requester to E
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

  // 5. Kick All Cores
  const kick_all_cores = (memory_address, current_core_index) => {
    setCores(prev => {
      const newCores = prev.map((core, i) => {
        if (i === current_core_index) return core;

        // Simulating the loop and clock tick
        // (We can't easily tick the clock inside a map, so we'll do it purely visually)
        if (core[memory_address]) {
          // We clone the core object
          const newCore = { ...core };
          newCore[memory_address] = [newCore[memory_address][0], 'I'];
          addLog(`BUS: Kicking Core ${i} to Invalid`);
          return newCore;
        }
        return core;
      });
      return newCores;
    });
    advanceClock(1, "BUS: Kick signal broadcast");
  };

  // --- USER ACTIONS ---

  const handleRead = () => {
    addLog(`--- START READ (Core ${opCore}, ${opAddr}) ---`);
    const current_core_cache = cores[opCore];

    // Case 1: Miss or Invalid
    if (!current_core_cache[opAddr] || current_core_cache[opAddr][1] === "I") {
      addLog("Cache Miss or Invalid. Sending bus snoop...");
      bus_read(opCore, opAddr);
      // In React, bus_read updates state. We stop here.
      return;
    }

    // Case 2: Hit
    const [current_value, current_state] = current_core_cache[opAddr];
    if (["M", "E", "S"].includes(current_state)) {
      addLog("Cache Hit.");
      addLog(`--Pre-- State: ${current_state} Value: ${current_value}`);
      advanceClock(1, "Cache Access");
      addLog(`--Post-- State: ${current_state} Value: ${current_value}`);
    }
  };

  const handleWrite = () => {
    addLog(`--- START WRITE (Core ${opCore}, ${opAddr}) ---`);

    // We must manipulate state carefully to match your procedural logic
    setCores(prevCores => {
      let newCores = JSON.parse(JSON.stringify(prevCores));
      let state = "";

      // 1. Check existence
      if (!newCores[opCore][opAddr]) {
        state = "I";
        // YOUR CODE: "creating cache line..."
        newCores[opCore][opAddr] = ["creating cache line...", "creating cache line..."];
        addLog(`Allocating new cache line at Core ${opCore}`);
      } else {
        state = newCores[opCore][opAddr][1];
      }

      // 2. Cascade Logic (Exactly as you wrote it)

      // S or I -> Kick others -> E
      if (state === "S" || state === "I") {
        addLog(`State is ${state}. Kicking others...`);

        // Inline kick_all_cores logic to modify our local 'newCores' copy
        for (let i = 0; i < newCores.length; i++) {
          if (i === opCore) continue;
          if (newCores[i][opAddr]) {
            newCores[i][opAddr][1] = 'I';
            // Note: Dirty data is lost here if it was M! (Faithful reproduction of bug)
          }
        }
        state = "E";
      }

      // E -> M
      if (state === "E") {
        // Just move to modified
        newCores[opCore][opAddr][1] = "M";
        state = "M";
      }

      // M -> Update Data
      if (state === "M") {
        advanceClock(1, "Writing data to Cache M");
        newCores[opCore][opAddr][0] = opVal;
      }

      return newCores;
    });
  };

  const handleAddCore = () => {
    setCores(prev => [...prev, {}]);
    addLog("SYSTEM: Added new Core");
  };

  const handleAddMemory = () => {
    addObjectToMemory(newMemAddr, newMemVal);
    setNewMemAddr(prev => "0x" + (parseInt(prev, 16) + 4).toString(16).toUpperCase()); // auto increment for convenience
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>MESI Simulator (User Port)</h2>
          <small>Faithful reproduction of Python logic</small>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#61dafb', fontSize: '1.5em', fontWeight: 'bold' }}>{clock}</div>
          <small>Global Clock</small>
        </div>
      </header>

      <div style={styles.grid}>

        {/* --- LEFT: CONTROLS & MEMORY --- */}
        <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Controls */}
          <div style={styles.card}>
            <div style={styles.sectionTitle}>CPU Operations</div>
            <div style={styles.inputGroup}>
              <select style={styles.input} value={opCore} onChange={e => setOpCore(Number(e.target.value))}>
                {cores.map((_, i) => <option key={i} value={i}>Core {i}</option>)}
              </select>
              <input style={styles.input} value={opAddr} onChange={e => setOpAddr(e.target.value)} placeholder="Addr" />
            </div>
            <div style={styles.inputGroup}>
              <input style={styles.input} value={opVal} onChange={e => setOpVal(e.target.value)} placeholder="Value (for Write)" />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={styles.button} onClick={handleRead}>Read</button>
              <button style={{ ...styles.button, background: '#c92a2a' }} onClick={handleWrite}>Write</button>
            </div>
          </div>

          {/* Memory Management */}
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Memory Management</div>
            <div style={styles.inputGroup}>
              <input style={styles.input} value={newMemAddr} onChange={e => setNewMemAddr(e.target.value)} placeholder="Addr" />
              <input style={styles.input} value={newMemVal} onChange={e => setNewMemVal(e.target.value)} placeholder="Value" />
            </div>
            <button style={{ ...styles.button, background: '#5f5f5f', width: '100%' }} onClick={handleAddMemory}>Add Object to RAM</button>
            <button style={{ ...styles.button, background: '#333', marginTop: '10px', width: '100%' }} onClick={handleAddCore}>+ Add New Core</button>
          </div>

          {/* RAM View */}
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Main Memory (RAM)</div>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {Object.keys(objectsInMemory).map(addr => (
                <div key={addr} style={styles.row}>
                  <span style={{ fontFamily: 'monospace', color: '#aaa' }}>{addr}</span>
                  <span style={{ color: 'white' }}>{objectsInMemory[addr]}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* --- RIGHT: CORES & LOGS --- */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Logs */}
          <div style={{ ...styles.card, padding: 0, overflow: 'hidden', height: '200px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px', background: '#333', borderBottom: '1px solid #444', fontWeight: 'bold' }}>System Bus & Operations Log</div>
            <div style={styles.logWindow}>
              {logs.length === 0 && <span style={{ color: '#666' }}>System Ready...</span>}
              {logs.map((l, i) => <div key={i} style={styles.logLine}>{l}</div>)}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Core Grid */}
          <div style={styles.grid}>
            {cores.map((cache, i) => (
              <div key={i} style={{ ...styles.card, flex: '1 1 250px' }}>
                <div style={styles.sectionTitle}>Core {i}</div>
                {Object.keys(cache).length === 0 ? (
                  <div style={{ color: '#555', fontStyle: 'italic' }}>Empty Cache</div>
                ) : (
                  Object.keys(cache).map(addr => {
                    // Check for your special placeholder array
                    // if it matches "creating cache line...", handle gracefully or show it
                    const val = cache[addr][0];
                    const state = cache[addr][1];
                    return (
                      <div key={addr} style={styles.row}>
                        <span style={{ color: '#aaa', fontSize: '0.9em' }}>{addr}</span>
                        <span style={{ color: 'white', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={val}>{val}</span>
                        <StateBadge state={state} />
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}