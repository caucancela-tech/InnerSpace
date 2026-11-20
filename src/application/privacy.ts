export const privacyDisclosure =
  "Los datos se guardan en IndexedDB en este navegador y origen. No están cifrados. El acceso administrativo local no protege frente a quien controle el dispositivo, las herramientas del navegador o scripts del mismo origen. Borrar los datos del sitio, perder el perfil o la expulsión por cuota puede eliminar la base. Guarda respaldos fuera del dispositivo; los ZIP tampoco están cifrados.";
export const defaultPreferences = {
  id: "owner",
  theme: "auto",
  locale: "es",
  dateFormat: "long",
  accessibilityPreferences: { largeText: false, reducedMotion: false },
  privacyPreferences: { externalConnections: false },
} as const;
