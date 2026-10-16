import React, { useState, useRef } from 'react';
import { LayoutTemplate, FileText, Save, FolderOpen, FilePlus, History, X, FlaskConical } from 'lucide-react';
import ToolbarPopover from './ToolbarPopover';
import useMenuLanguage from '../ui/useMenuLanguage';
import useStore from '../store/useStore';
import { hasFileSystemAccess, openFile, saveFile, saveFileAs } from '../utils/fileSystem';
import { migrateProject } from '../services/project.js';
import { makePortable, importEmbedded } from '../services/portable.js';

const Header = ({ children, onExample, onHistory, inert }) => {
    const t = useMenuLanguage();
    const {
        projectTitle,
        setProjectTitle,
        fileHandle,
        setFileHandle,
        addToRecentFiles
    } = useStore();

    const [report,setReport]=useState(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const fileInputRef = useRef(null);
    const titleInputRef = useRef(null);

    const handleNew = async () => {
        try {
            await useStore.getState().replaceWorkspace({title:"Untitled VSM",nodes:[],edges:[],tools:useStore.getState().tools,actors:useStore.getState().actors,knowledge:useStore.getState().knowledge});
            setFileHandle(null);
        } catch(error) { alert(error.message); }
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
        <header className="project-header" inert={inert}>
            <div className="project-identity">
                <div className="studio-brand" title="VSM Studio"><LayoutTemplate size={18} /><span>VSM STUDIO</span></div>
                <ToolbarPopover label={t("Projet")}>
                    {close => <>
                        <span className="menu-section-label">{t("Espace de travail")}</span>
                        <MenuItem icon={<History size={16} />} label={t("Projets & historique")} onClick={() => {close();onHistory();}} />
                        <MenuItem icon={<FilePlus size={16} />} label={t("Nouveau projet")} onClick={() => {close();handleNew();}} />
                        <MenuItem icon={<FolderOpen size={16} />} label={t("Ouvrir un fichier…")} onClick={() => {close();handleOpenClick();}} />
                        <MenuItem icon={<FlaskConical size={16} />} label={t("Charger l’exemple KYC")} onClick={() => {close();onExample();}} />
                        <div className="menu-separator" />
                        <span className="menu-section-label">{t("Exporter et partager")}</span>
                        <MenuItem icon={<Save size={16} />} label={t("Enregistrer le fichier")} onClick={() => {close();handleSave();}} />
                        <MenuItem icon={<Save size={16} />} label={t("Enregistrer sous…")} onClick={() => {close();handleSaveAs();}} />
                        <MenuItem icon={<FileText size={16} />} label={t("Exporter le rapport PDF")} onClick={handleExportPDF} />
                        {report && <a className="report-download" href={report.url} download={report.name}>{t("Télécharger PDF")}</a>}
                        <div className="menu-separator" />
                        <MenuItem icon={<X size={16} />} label={t("Fermer le projet")} onClick={() => {close();handleClose();}} />
                    </>}
                </ToolbarPopover>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden accept=".json,.vsm" />
                {isEditingTitle ? <input className="project-title-input" aria-label={t("Nom du projet")} ref={titleInputRef}
                    value={projectTitle} onChange={e=>setProjectTitle(e.target.value)} onBlur={handleTitleBlur} onKeyDown={handleTitleKeyDown} />
                    : <h1 className="project-title"><button title={t("Renommer le projet")} onClick={handleTitleClick}>{projectTitle}</button></h1>}
            </div>
            <div className="project-actions">
                {children}
            </div>
        </header>
    );
};

const MenuItem = ({ icon, label, onClick }) => <button className="project-menu-item" type="button" onClick={onClick}>{icon}<span>{label}</span></button>;
export default Header;
