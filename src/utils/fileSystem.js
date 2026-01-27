export const hasFileSystemAccess = () => 'showOpenFilePicker' in window;

export const openFile = async () => {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{
                description: 'VSM Files',
                accept: { 'application/json': ['.vsm', '.json'] }
            }],
            multiple: false
        });
        const file = await handle.getFile();
        const text = await file.text();
        return { handle, text, name: file.name };
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            throw err;
        }
        return null;
    }
};

export const saveFile = async (handle, content) => {
    try {
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return true;
    } catch (err) {
        console.error(err);
        throw err;
    }
};

export const saveFileAs = async (content, suggestedName) => {
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: suggestedName,
            types: [{
                description: 'VSM Files',
                accept: { 'application/json': ['.vsm'] }
            }]
        });
        await saveFile(handle, content);
        return handle;
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            throw err;
        }
        return null;
    }
};
