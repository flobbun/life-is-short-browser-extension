import './App.css';
import { getExtensionUrl } from '@/src/core/runtime-url';

function App() {
  const openDashboard = async (): Promise<void> => {
    const dashboardUrl = getExtensionUrl('/dashboard.html');
    if (!dashboardUrl) {
      return;
    }

    await browser.tabs.create({
      url: dashboardUrl,
    });
    window.close();
  };

  return (
    <main className="popup-root">
      <button className="dashboard-button" onClick={() => void openDashboard()}>
        Dashboard
      </button>
    </main>
  );
}

export default App;
