import React, { useState, useRef } from 'react';
import { Play, Zap, LayoutTemplate, FileText, Save, FolderOpen, Printer, LogOut, ChevronDown, FilePlus, Clock, File, X, Trash2 } from 'lucide-react';
import useStore from '../store/useStore';
import { useReactFlow } from 'reactflow';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { hasFileSystemAccess, openFile, saveFile, saveFileAs } from '../utils/fileSystem';

const Header = ({ children }) => {
    const {
        nodes,
        edges,
        setGraph,
        resetGraph,
        projectTitle,
        setProjectTitle,
        fileHandle,
        setFileHandle,
        addToRecentFiles,
        tools,
        actors, knowledge, mergeLibraries
    } = useStore();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const fileInputRef = useRef(null);
    const titleInputRef = useRef(null);

    const handleNew = () => {
        if (window.confirm('Are you sure you want to start a new project? Unsaved changes will be lost.')) {
            resetGraph();
            setFileHandle(null); // Clear file handle for new project
            setProjectTitle('Untitled VSM');
        }
        setIsMenuOpen(false);
    };

    const getProjectData = () => ({
        meta: {
            version: '1.0',
            application: 'vsm-builder',
            timestamp: new Date().toISOString()
        },
        title: projectTitle,
        nodes,
        edges,
        tools, actors, knowledge // Portable resource libraries
    });

    const handleSave = async () => {
        const content = JSON.stringify(getProjectData(), null, 2);

        if (fileHandle && hasFileSystemAccess()) {
            try {
                await saveFile(fileHandle, content);
                // Update recent files
                addToRecentFiles({ title: projectTitle, content: JSON.parse(content) });
                alert('Saved successfully!');
            } catch (error) {
                console.error('Save failed:', error);
                alert('Failed to save file.');
            }
        } else {
            handleSaveAs();
        }
        setIsMenuOpen(false);
    };

    const handleSaveAs = async () => {
        const content = JSON.stringify(getProjectData(), null, 2);

        if (hasFileSystemAccess()) {
            const handle = await saveFileAs(content, `${projectTitle}.vsm`);
            if (handle) {
                setFileHandle(handle);
                setProjectTitle(handle.name.replace(/\.(vsm|json)$/, ''));
                addToRecentFiles({ title: handle.name.replace(/\.(vsm|json)$/, ''), content: JSON.parse(content) });
            }
        } else {
            // Fallback to download
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectTitle}.vsm`;
            a.click();
            URL.revokeObjectURL(url);
            addToRecentFiles({ title: projectTitle, content: JSON.parse(content) });
        }
        setIsMenuOpen(false);
    };

    const handleOpenClick = async () => {
        if (hasFileSystemAccess()) {
            const result = await openFile();
            if (result) {
                try {
                    const data = JSON.parse(result.text);
                    loadProject(data, result.name, result.handle);
                } catch (error) {
                    alert('Error parsing file: ' + error.message);
                }
            }
        } else {
            fileInputRef.current.click();
        }
        setIsMenuOpen(false);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                loadProject(data, file.name);
            } catch (error) {
                alert('Error parsing file: ' + error.message);
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    };

    const loadProject = (data, filename, handle = null) => {
        try {
            const loadedNodes = data.nodes;
            const loadedEdges = data.edges;
            const loadedTools = data.tools || []; // Load tools
            const loadedTitle = data.title || data.projectTitle || filename.replace(/\.(json|vsm)$/, '');

            if (loadedNodes && loadedEdges) {
                setGraph(loadedNodes, loadedEdges, loadedTitle);

                // Restore tools
                mergeLibraries({ tools: loadedTools, actors: data.actors, knowledge: data.knowledge });

                setFileHandle(handle);
                addToRecentFiles({ title: loadedTitle, content: data });
            } else {
                alert('Invalid file format: Missing nodes or edges data.');
            }
        } catch (error) {
            console.error("Error loading project:", error);
            alert(`Failed to load project: ${error.message}`);
        }
    };

    const { fitView, getViewport, setViewport } = useReactFlow();

    const handleExportPDF = async () => {
        setIsMenuOpen(false);
        // Wait for menu to close
        setTimeout(async () => {
            try {
                const element = document.querySelector('.react-flow');
                if (!element) return;

                // Save current viewport
                const viewport = getViewport();

                // Fit view to show all content
                await fitView({ padding: 0.2, duration: 0 });

                // Wait a moment for render (increased to ensure full render)
                await new Promise(resolve => setTimeout(resolve, 500));

                // Hide controls for screenshot
                const controls = document.querySelector('.react-flow__controls');
                const panel = document.querySelector('.react-flow__panel');
                if (controls) controls.style.display = 'none';
                if (panel) panel.style.display = 'none';

                const canvas = await html2canvas(element, {
                    scale: 2, // Improve quality
                    useCORS: true,
                    logging: false
                });

                // Restore controls
                if (controls) controls.style.display = '';
                if (panel) panel.style.display = '';

                // Restore viewport
                setViewport(viewport);

                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });

                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save(`${projectTitle}.pdf`);
            } catch (error) {
                console.error('PDF Export failed:', error);
                alert('Failed to export PDF. See console for details.');
            }
        }, 100);
    };

    const handleClose = () => {
        if (window.confirm('Are you sure you want to close the current project? Unsaved changes will be lost.')) {
            resetGraph();
            setFileHandle(null); // Clear file handle
            setProjectTitle('Untitled VSM');
        }
        setIsMenuOpen(false);
    };

    const handleTitleClick = () => {
        setIsEditingTitle(true);
        setTimeout(() => titleInputRef.current?.focus(), 0);
    };

    const handleTitleBlur = () => {
        setIsEditingTitle(false);
        if (!projectTitle.trim()) {
            setProjectTitle('Untitled VSM');
        }
    };

    const handleTitleKeyDown = (e) => {
        if (e.key === 'Enter') {
            setIsEditingTitle(false);
        }
    };

    return (
        <header style={{
            height: 'var(--header-height)',
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1rem',
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 100
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <LayoutTemplate size={20} color="var(--color-primary)" /><span className="workspace-label">VSM STUDIO</span>

                    {/* File Menu */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.5rem 0.75rem',
                                background: isMenuOpen ? 'var(--color-bg)' : 'transparent',
                                border: '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                color: 'var(--color-text)'
                            }}
                        >
                            File <ChevronDown size={14} />
                        </button>

                        {isMenuOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: '0.25rem',
                                background: '#14212a',
                                border: '1px solid var(--color-border)',
                                borderRadius: '4px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                minWidth: '220px',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '0.25rem 0',
                                zIndex: 1000
                            }}>
                                <MenuItem icon={<FilePlus size={14} />} label="New" onClick={handleNew} />
                                <MenuItem icon={<FolderOpen size={14} />} label="Open..." onClick={handleOpenClick} />
                                <MenuItem icon={<Save size={14} />} label="Save" onClick={handleSave} />
                                <MenuItem icon={<Save size={14} />} label="Save As..." onClick={handleSaveAs} />
                                <div style={{ height: '1px', background: 'var(--color-border)', margin: '0.25rem 0' }} />
                                <MenuItem icon={<FileText size={14} />} label="Export PDF" onClick={handleExportPDF} />
                                <MenuItem icon={<X size={14} />} label="Close" onClick={handleClose} />
                            </div>
                        )}

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                            accept=".json,.vsm"
                        />
                    </div>

                    {/* VSM Name */}
                    {isEditingTitle ? (
                        <input
                            ref={titleInputRef}
                            type="text"
                            value={projectTitle}
                            onChange={(e) => setProjectTitle(e.target.value)}
                            onBlur={handleTitleBlur}
                            onKeyDown={handleTitleKeyDown}
                            style={{
                                fontSize: '1.25rem',
                                fontWeight: 700,
                                border: '1px solid var(--color-primary)',
                                borderRadius: '4px',
                                padding: '0 0.25rem',
                                outline: 'none',
                                width: '300px'
                            }}
                        />
                    ) : (
                        <h1
                            onClick={handleTitleClick}
                            style={{
                                fontSize: '1.25rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: '1px solid transparent',
                                padding: '0 0.25rem',
                                borderRadius: '4px'
                            }}
                            title="Click to edit title"
                            onMouseEnter={(e) => e.currentTarget.style.border = '1px dashed #ccc'}
                            onMouseLeave={(e) => e.currentTarget.style.border = '1px solid transparent'}
                        >
                            {projectTitle}
                        </h1>
                    )}
                </div>
            </div>

            {children}

            {/* Overlay to close menu when clicking outside */}
            {isMenuOpen && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                    onClick={() => setIsMenuOpen(false)}
                />
            )}
        </header>
    );
};

const MenuItem = ({ icon, label, onClick, danger, small, hasSubmenu }) => (
    <button
        type="button"
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: small ? '0.25rem 1rem' : '0.5rem 1rem',
            background: 'transparent',
            border: 'none',
            width: '100%',
            textAlign: 'left',
            fontSize: small ? '0.8rem' : '0.875rem',
            cursor: 'pointer',
            color: danger ? '#df9296' : 'var(--color-text)',
            transition: 'background 0.1s',
            paddingLeft: small ? '1.5rem' : '1rem'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#0d171e'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
        {icon}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {hasSubmenu && <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} />}
    </button>
);

export default Header;
