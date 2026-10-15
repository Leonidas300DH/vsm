import React, { useState, useRef } from 'react';
import { Play, Zap, LayoutTemplate, FileText, Save, FolderOpen, Printer, LogOut, ChevronDown, FilePlus, Clock, File, X, Trash2 } from 'lucide-react';
import useStore from '../store/useStore';
import { hasFileSystemAccess, openFile, saveFile, saveFileAs } from '../utils/fileSystem';
import { migrateProject } from '../services/project.js';
import { makePortable, importEmbedded } from '../services/portable.js';

const Header = ({ children }) => {
    const {
        projectTitle,
        setProjectTitle,
        fileHandle,
        setFileHandle,
        addToRecentFiles
    } = useStore();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [report,setReport]=useState(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const fileInputRef = useRef(null);
    const titleInputRef = useRef(null);

    const handleNew = async () => {
        try {
            await useStore.getState().replaceWorkspace({title:"Untitled VSM",nodes:[],edges:[],tools:useStore.getState().tools,actors:useStore.getState().actors,knowledge:useStore.getState().knowledge});
            setFileHandle(null);
        } catch(error) { alert(error.message); }
        setIsMenuOpen(false);
    };

    const getProjectData = async () => {
        const project = await makePortable(useStore.getState().getWorkspaceProject());
        if (project.missingFiles.length && !window.confirm(`Pièces jointes indisponibles : ${project.missingFiles.map(f=>f.name||f.id).join(', ')}. Exporter avec ces références manquantes ?`)) return null;
        return project;
    };

    const handleSave = async () => {
        const project = await getProjectData();
        if (!project) return;
        const content = JSON.stringify(project, null, 2);

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
        const project = await getProjectData();
        if (!project) return;
        const content = JSON.stringify(project, null, 2);

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
            setTimeout(()=>URL.revokeObjectURL(url),1000);
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
                    await loadProject(data, result.name, result.handle);
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
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                await loadProject(data, file.name);
            } catch (error) {
                alert('Error parsing file: ' + error.message);
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    };

    const loadProject = async (data, filename, handle = null) => {
        const project = migrateProject(data);
        const title = project.title || filename.replace(/\.(json|vsm)$/, '');
        await importEmbedded(project);
        await useStore.getState().replaceWorkspace({ ...project, title });
        setFileHandle(handle);
        addToRecentFiles({ title, content: data });
    };

    const handleExportPDF = async () => {
        setIsMenuOpen(false);
        try { const {exportReport}=await import('../services/report.js'); if(report)URL.revokeObjectURL(report.url);setReport(await exportReport(useStore.getState().getWorkspaceProject())); }
        catch(error){alert(error.message);}
    };

    const handleClose = handleNew;

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
                                background: 'var(--c-14212a)',
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
                            onMouseEnter={(e) => e.currentTarget.style.border = '1px dashed var(--c-cccccc)'}
                            onMouseLeave={(e) => e.currentTarget.style.border = '1px solid transparent'}
                        >
                            {projectTitle}
                        </h1>
                    )}
                </div>
            </div>

            {report&&<a href={report.url} download={report.name}>Télécharger PDF</a>}
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
            color: danger ? 'var(--c-df9296)' : 'var(--color-text)',
            transition: 'background 0.1s',
            paddingLeft: small ? '1.5rem' : '1rem'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-0d171e)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
        {icon}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {hasSubmenu && <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} />}
    </button>
);

export default Header;
