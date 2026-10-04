const fs = require('fs');
const path = require('path');

const useLinkingNativePath = path.join(__dirname, '..', 'node_modules', 'expo-router', 'build', 'fork', 'useLinking.native.js');
const navigationContainerPath = path.join(__dirname, '..', 'node_modules', 'expo-router', 'build', 'fork', 'NavigationContainer.js');

if (fs.existsSync(useLinkingNativePath)) {
  let content = fs.readFileSync(useLinkingNativePath, 'utf8');
  if (!content.includes('setTimeout(() => { onUnhandledLinking')) {
    content = content.replace(
      'onUnhandledLinking((0, extractPathFromURL_1.extractExpoPathFromURL)(prefixes, url));',
      'setTimeout(() => { onUnhandledLinking((0, extractPathFromURL_1.extractExpoPathFromURL)(prefixes, url)); }, 0);'
    );
    fs.writeFileSync(useLinkingNativePath, content, 'utf8');
    console.log('[patch-expo-router] Patched useLinking.native.js');
  }
}

if (fs.existsSync(navigationContainerPath)) {
  let content = fs.readFileSync(navigationContainerPath, 'utf8');
  if (!content.includes('safeSetLastUnhandledLink')) {
    content = content.replace(
      'const [lastUnhandledLink, setLastUnhandledLink] = react_1.default.useState();',
      `const [lastUnhandledLink, setLastUnhandledLink] = react_1.default.useState();
    const isMountedRef = react_1.default.useRef(false);
    react_1.default.useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);
    const safeSetLastUnhandledLink = react_1.default.useCallback((value) => {
        if (isMountedRef.current) {
            setLastUnhandledLink(value);
        } else {
            setTimeout(() => {
                if (isMountedRef.current) {
                    setLastUnhandledLink(value);
                }
            }, 0);
        }
    }, []);`
    );
    content = content.replace(
      'setLastUnhandledLink);',
      'safeSetLastUnhandledLink);'
    );
    fs.writeFileSync(navigationContainerPath, content, 'utf8');
    console.log('[patch-expo-router] Patched NavigationContainer.js');
  }
}
