;(function () {
  // Use resource map instead of base path
  const resources = window.SyntaxHighlighterResources;

  if (!resources) {
    console.error('SyntaxHighlighter resources not found');
    return;
  }

  console.log('Starting SyntaxHighlighter initialization...');
  console.log('Available resources:', Object.keys(resources));

  const process = async () => {
    const waitDOMLoaded = () =>
      new Promise(resolve => {
        document.readyState !== "loading" ? resolve() : document.addEventListener("DOMContentLoaded", resolve);
      });

    const loadScript = src => {
      return new Promise((resolve, reject) => {
        console.log('Loading script:', src);
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => {
          console.log('Script loaded successfully:', src);
          resolve();
        };
        script.onerror = (error) => {
          console.error('Script failed to load:', src, error);
          reject(error);
        };
        document.head.appendChild(script);
      });
    };

    const loadStyle = src => {
      return new Promise((resolve, reject) => {
        console.log('Loading style:', src);
        const style = document.createElement("link");
        style.rel = "stylesheet";
        style.type = "text/css";
        style.href = src;
        style.onload = () => {
          console.log('Style loaded successfully:', src);
          resolve();
        };
        style.onerror = (error) => {
          console.error('Style failed to load:', src, error);
          reject(error);
        };
        document.head.appendChild(style);
      });
    };

    try {
      // Load CSS first
      await loadStyle(resources['styles/shCoreDefault.css']);
      
      // Load core scripts sequentially
      await loadScript(resources['scripts/shCore.js']);
      await loadScript(resources['scripts/shAutoloader.js']);
      
      // Wait for DOM to be ready
      await waitDOMLoaded();

      console.log('Setting up SyntaxHighlighter autoloader...');
      
      // Check if SyntaxHighlighter is available
      if (typeof SyntaxHighlighter === 'undefined') {
        throw new Error('SyntaxHighlighter not loaded');
      }

      SyntaxHighlighter.autoloader(
        `applescript           ${resources['scripts/shBrushAppleScript.js']}`,
        `actionscript3 as3     ${resources['scripts/shBrushAS3.js']}`,
        `bash shell            ${resources['scripts/shBrushBash.js']}`,
        `coldfusion cf         ${resources['scripts/shBrushColdFusion.js']}`,
        `cpp c                 ${resources['scripts/shBrushCpp.js']}`,
        `c# c-sharp csharp     ${resources['scripts/shBrushCSharp.js']}`,
        `css                   ${resources['scripts/shBrushCss.js']}`,
        `delphi pascal         ${resources['scripts/shBrushDelphi.js']}`,
        `diff patch pas        ${resources['scripts/shBrushDiff.js']}`,
        `erl erlang            ${resources['scripts/shBrushErlang.js']}`,
        `groovy                ${resources['scripts/shBrushGroovy.js']}`,
        `java                  ${resources['scripts/shBrushJava.js']}`,
        `jfx javafx            ${resources['scripts/shBrushJavaFX.js']}`,
        `js jscript javascript ${resources['scripts/shBrushJScript.js']}`,
        `perl pl               ${resources['scripts/shBrushPerl.js']}`,
        `php                   ${resources['scripts/shBrushPhp.js']}`,
        `text plain            ${resources['scripts/shBrushPlain.js']}`,
        `ps powershell         ${resources['scripts/shBrushPowerShell.js']}`,
        `py python             ${resources['scripts/shBrushPython.js']}`,
        `ruby rails ror rb     ${resources['scripts/shBrushRuby.js']}`,
        `sass scss             ${resources['scripts/shBrushSass.js']}`,
        `scala                 ${resources['scripts/shBrushScala.js']}`,
        `sql                   ${resources['scripts/shBrushSql.js']}`,
        `vb vbnet              ${resources['scripts/shBrushVb.js']}`,
        `xml xhtml xslt html   ${resources['scripts/shBrushXml.js']}`
      );
      
      SyntaxHighlighter.defaults["gutter"] = false;
      
      console.log('Running SyntaxHighlighter.all()...');
      SyntaxHighlighter.all();
      
      console.log('SyntaxHighlighter initialization complete');
    } catch (error) {
      console.error('SyntaxHighlighter initialization failed:', error);
    }
  };

  process();
})();
