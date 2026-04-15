export function showNavigationInstructionsModal() {
  const maxWidth = Math.max(380, Math.min(560, window.innerWidth - 40));
  const maxHeight = Math.max(260, Math.min(360, window.innerHeight - 60));

  const instructionsWindow = new dhx.Window({
    width: maxWidth,
    height: maxHeight,
    title: "Navigation Guide",
    movable: true,
    modal: true,
    closable: true,
    resizable: false
  });

  instructionsWindow.attachHTML(`
    <div class="navigation-help-modal">
      <div class="navigation-help-title">How to navigate the model</div>
      <div class="navigation-help-subtitle">Use these controls in the 3D viewport:</div>
      <ul class="navigation-help-list">
        <li><strong>Pan:</strong> middle mouse button drag</li>
        <li><strong>Orbit:</strong> Shift + middle mouse button drag</li>
        <li><strong>Zoom:</strong> mouse wheel</li>
        <li><strong>Select part:</strong> left click on a component</li>
        <li><strong>Reset view:</strong> click the Reset button in the toolbar</li>
      </ul>
      <div class="navigation-help-note">
        Tip: switch between Ortho faces and Isometric from the View controls in the toolbar.
      </div>
    </div>
  `);

  const teardown = () => {
    try { instructionsWindow.destructor(); } catch (e) {}
  };

  instructionsWindow.events.on("afterHide", teardown);
  instructionsWindow.show();
}
