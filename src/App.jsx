import React from 'react';
import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import Timeline from './components/Timeline';
import VSMCanvas from './components/VSMCanvas';
import Header from './components/Header';

import { ReactFlowProvider } from 'reactflow';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isPropertiesOpen, setIsPropertiesOpen] = React.useState(true);

  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', flexDirection: 'column' }}>
        <Header />
        <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
          {isSidebarOpen && <Sidebar onClose={() => setIsSidebarOpen(false)} />}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              style={{
                position: 'absolute',
                top: '1rem',
                left: '1rem',
                zIndex: 10,
                background: '#fff',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                padding: '0.5rem',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              title="Open Sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            </button>
          )}

          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <VSMCanvas />
            </div>
            <Timeline />
          </div>

          {isPropertiesOpen && <PropertiesPanel onClose={() => setIsPropertiesOpen(false)} />}
          {!isPropertiesOpen && (
            <button
              onClick={() => setIsPropertiesOpen(true)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                zIndex: 10,
                background: '#fff',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                padding: '0.5rem',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              title="Open Properties"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>
            </button>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export default App;
