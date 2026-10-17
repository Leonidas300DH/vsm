import { Settings, Sun, Moon, Square, Sparkles } from 'lucide-react';
import ToolbarPopover from './ToolbarPopover';
import useStore from '../store/useStore';
import useMenuLanguage from '../ui/useMenuLanguage';

export default function SettingsMenu() {
  const t = useMenuLanguage();
  const { theme, setTheme, skin, setSkin, menuLanguage, setMenuLanguage } = useStore();
  return <ToolbarPopover label={t('Réglages')} icon={<Settings size={17} />} iconOnly align="right">
    <span className="menu-section-label">{t('Réglages')}</span>
    <label className="view-focus">{t('Langue des menus')}
      <select value={menuLanguage} onChange={e => setMenuLanguage(e.target.value)}>
        <option value="fr">Français</option><option value="en">English</option>
      </select>
    </label>
    <span className="menu-section-label">{t('Apparence')}</span>
    <div className="theme-options" role="group" aria-label={t('Apparence')}>
      <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={15} />{t('Sombre')}</button>
      <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun size={15} />{t('Clair')}</button>
    </div>
    <span className="menu-section-label">{t('Style')}</span>
    <div className="theme-options" role="group" aria-label={t('Style')}>
      <button aria-pressed={skin === 'classic'} onClick={() => setSkin('classic')}><Square size={15} />{t('Classique')}</button>
      <button aria-pressed={skin === 'signal-glass'} onClick={() => setSkin('signal-glass')}><Sparkles size={15} />Signal Glass</button>
    </div>
    <p className="settings-help">{t('La langue concerne les menus de navigation. Les données de vos cartes restent dans leur langue d’origine.')}</p>
    <p className="settings-help">{t('Préférences enregistrées sur cet appareil.')}</p>
  </ToolbarPopover>;
}
