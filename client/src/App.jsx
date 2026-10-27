import React, { useState, useEffect } from 'react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'customer-info', label: 'Customer Info' },
  { id: 'data-mapping', label: 'Data Mapping' },
  { id: 'tenant-setup', label: 'Tenant Setup' },
  { id: 'import', label: 'Import' }
];

async function readImportResponse(response) {
  const body = await response.json().catch(() => null);
  if (!body) {
    throw new Error(`Import service returned an unreadable response (HTTP ${response.status}). Please retry.`);
  }
  if (!response.ok) throw new Error(body.error || `Import request failed (HTTP ${response.status})`);
  return body;
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [onboardingData, setOnboardingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/onboarding')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Invalid response format');
        return data;
      })
      .then(data => {
        setOnboardingData(data);
        setError(null);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch onboarding data:', err);
        setError(err.message);
        setOnboardingData([]);
        setLoading(false);
      });
  }, [activeTab === 'dashboard']);

  return (
    <div className="app">
      <header>
        <h1>Onboarding Dashboard</h1>
        <p>Customer Success Team - Internal Tool</p>
      </header>

      <nav className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {activeTab === 'dashboard' && (
          <DashboardTab data={onboardingData} loading={loading} error={error} onNavigate={setActiveTab} />
        )}
        {activeTab === 'customer-info' && (
          <CustomerInfoTab />
        )}
        {activeTab === 'data-mapping' && (
          <DataMappingTab />
        )}
        {activeTab === 'tenant-setup' && (
          <TenantSetupTab />
        )}
        {activeTab === 'import' && (
          <ImportTab />
        )}
      </main>
    </div>
  );
}

function DashboardTab({ data, loading, error, onNavigate }) {
  if (loading) {
    return <div className="placeholder"><p>Loading...</p></div>;
  }

  if (error) {
    return (
      <div className="placeholder">
        <p style={{ color: '#dc2626' }}>⚠️ Failed to load onboarding data</p>
        <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="placeholder"><p>No customers in the onboarding queue</p></div>;
  }

  return (
    <div>
      <h2>Onboarding Queue</h2>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>
        {data.length} customer(s) awaiting onboarding
      </p>

      {data.map(item => (
        <div key={item.customerId} className="customer-card">
          <h3>{item.customerName}</h3>
          <div className="customer-meta">
            <span>📍 {item.customerRegion}</span>
            <span>🏭 {item.customerIndustry}</span>
            {item.customerContactEmail && <span>✉️ {item.customerContactEmail}</span>}
          </div>

          <div className="progress-section">
            <ProgressBar percent={item.progressPercent} />
            <Checklist steps={item.steps} onNavigate={onNavigate} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ percent }) {
  return (
    <div className="progress-bar-container">
      <div 
        className="progress-bar" 
        style={{ width: `${Math.max(percent, 0)}%` }}
      >
        {percent > 0 ? `${percent}%` : ''}
      </div>
    </div>
  );
}

const STEP_TABS = {
  'Customer Info': 'customer-info',
  'Data Mapping': 'data-mapping',
  'Tenant Setup': 'tenant-setup',
  Import: 'import'
};

function Checklist({ steps, onNavigate }) {
  return (
    <ul className="checklist">
      {steps.map(step => (
        <li key={step.id}>
          <span className={`step-status ${step.status}`}>
            {step.status === 'completed' ? '✓' : step.order}
          </span>
          {onNavigate && STEP_TABS[step.name] ? (
            <a
              href={`#${STEP_TABS[step.name]}`}
              onClick={e => { e.preventDefault(); onNavigate(STEP_TABS[step.name]); }}
            >
              {step.name}
            </a>
          ) : (
            <span>{step.name}</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#9ca3af' }}>
            {step.status.replace('_', ' ')}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DataMappingTab() {
  const [preview, setPreview] = useState(null);
  const [selectedCsv, setSelectedCsv] = useState(null);
  const [savedClients, setSavedClients] = useState([]);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/sample-data/abc/clients/preview')
      .then(async response => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(setPreview)
      .catch(err => setError(err.message));
    fetch('/api/clients')
      .then(response => response.json())
      .then(setSavedClients)
      .catch(() => setError('Could not load saved clients'));
  }, []);

  async function selectFile(event) {
    const file = event.target.files?.[0];
    setPreview(null);
    setSelectedCsv(null);
    setSummary(null);
    setError(null);
    if (!file) return;
    setBusy(true);
    try {
      const csvText = await file.text();
      const response = await fetch('/api/client-imports/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, fileName: file.name })
      });
      const body = await readImportResponse(response);
      setPreview(body);
      setSelectedCsv(csvText);
    } catch (err) {
      setError(err.message || 'Could not preview selected file');
    } finally {
      setBusy(false);
    }
  }

  async function importSelectedFile() {
    if (!selectedCsv) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/import/customer-a/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: selectedCsv })
      });
      const body = await readImportResponse(response);
      setSavedClients(body.clients);
      setSummary(`${body.imported} imported, ${body.skipped} already present, ${body.rejected.length} rejected`);
    } catch (err) {
      setError(err.message || 'Could not import selected file');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mapping-preview">
      <h2>Data Mapping</h2>
      <p>Select an ABC Accounting clients CSV to check its ID/name mapping and import its valid clients.</p>
      <div className="mapping-controls">
        <label htmlFor="client-csv">Client CSV</label>
        <input id="client-csv" type="file" accept=".csv,text/csv" onChange={selectFile} />
        <button type="button" onClick={importSelectedFile} disabled={busy || !selectedCsv || !preview?.readyCount}>
          {busy ? 'Working...' : 'Import selected clients'}
        </button>
      </div>
      {error && <p role="alert" className="mapping-error">{error}</p>}
      {summary && <p role="status" className="mapping-success">{summary}</p>}
      {preview ? (
        <>
          <p>Previewing {preview.sourceName} before import. This check covers client IDs and names.</p>
          <div className="mapping-columns" aria-label="Column mapping">
            {preview.mappings.map(mapping => (
              <span key={mapping.target}>{mapping.source} → {mapping.target}</span>
            ))}
          </div>
          <p className="mapping-summary">
            {preview.totalRows} rows · {preview.readyCount} ID/name ready · {preview.errorCount} need attention
          </p>
          <div className="mapping-table-container">
            <table>
              <thead><tr><th>CSV row</th><th>Client ID</th><th>Name</th><th>Result</th></tr></thead>
              <tbody>
                {preview.rows.map(row => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>{row.clientId || '—'}</td>
                    <td>{row.name || '—'}</td>
                    <td>{row.errors.length ? row.errors.join(', ') : 'Ready'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : !error && <p>Loading client preview...</p>}
      <div className="imported-clients">
        <h3>Saved clients</h3>
        {savedClients.length === 0 ? <p>No clients imported yet.</p> : (
          <ul>{savedClients.map(client => <li key={client.id}>{client.id} — {client.name}</li>)}</ul>
        )}
      </div>
    </section>
  );
}

const INTAKE_FIELDS = [
  { name: 'name', label: 'Customer name' },
  { name: 'industry', label: 'Industry' },
  { name: 'region', label: 'Region' },
  { name: 'contactEmail', label: 'Contact email', type: 'email' }
];
const EMPTY_FORM = { name: '', industry: '', region: '', contactEmail: '' };

function CustomerInfoTab() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setCreated(null);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 400 && body.errors) {
        setErrors(body.errors);
      } else if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      } else {
        setErrors({});
        setCreated(body.customer);
        setForm(EMPTY_FORM);
      }
    } catch (err) {
      setErrors({ form: `Could not save customer: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Customer Info</h2>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>
        Collect and validate customer information
      </p>
      <form onSubmit={submit} noValidate style={{ maxWidth: '420px', display: 'grid', gap: '12px' }}>
        {INTAKE_FIELDS.map(f => (
          <label key={f.name} style={{ display: 'grid', gap: '4px' }}>
            {f.label}
            <input
              type={f.type || 'text'}
              value={form[f.name]}
              onChange={e => setForm({ ...form, [f.name]: e.target.value })}
            />
            {errors[f.name] && <span role="alert" style={{ color: '#dc2626', fontSize: '0.85rem' }}>{errors[f.name]}</span>}
          </label>
        ))}
        {errors.form && <span role="alert" style={{ color: '#dc2626' }}>{errors.form}</span>}
        <button type="submit" className="tab active" disabled={busy}>
          {busy ? 'Saving...' : 'Add customer'}
        </button>
      </form>
      {created && (
        <p data-testid="intake-success" style={{ marginTop: '20px' }}>
          ✓ Added {created.name} to the onboarding queue
        </p>
      )}
    </div>
  );
}

function ImportTab() {
  const [result, setResult] = useState(null);
  const [clients, setClients] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/clients')
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setClients)
      .catch(err => setError(`Could not load saved clients: ${err.message}`));
  }, []);

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/import/customer-a/clients', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
      setClients(data.clients);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Import</h2>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>
        ABC Accounting (Customer A) — clients.csv
      </p>
      <button className="tab active" onClick={runImport} disabled={busy}>
        {busy ? 'Importing...' : 'Import clients'}
      </button>

      {error && <p style={{ color: '#dc2626' }}>⚠️ Import failed: {error}</p>}

      {(result || clients.length > 0) && (
        <div style={{ marginTop: '20px' }}>
          {result && <p data-testid="import-summary">
            Imported {result.imported} client(s), {result.rejected.length} rejected
          </p>}
          <h3>Saved clients</h3>
          <table data-testid="clients-table" style={{ width: '100%', textAlign: 'left' }}>
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Type</th><th>Status</th><th>Start date</th><th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                  <td>{c.entityType}</td>
                  <td>{c.status}</td>
                  <td>{c.startDate}</td>
                  <td>{c.annualRevenue == null ? '—' : c.annualRevenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const PLANS = ['starter', 'professional', 'enterprise'];

function TenantSetupTab() {
  const [tenants, setTenants] = useState(null);
  const [plans, setPlans] = useState({});
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    return fetch('/api/tenants')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(setTenants)
      .catch(err => setError(err.message));
  }
  useEffect(() => { load(); }, []);

  async function provision(customerId, plan) {
    setBusyId(customerId);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${customerId}/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!tenants) return <div className="placeholder">{error ? `⚠️ ${error}` : 'Loading tenants...'}</div>;

  return (
    <div>
      <h2>Tenant Setup</h2>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>Provision and configure customer tenants</p>
      {error && <p role="alert" style={{ color: '#dc2626' }}>⚠️ {error}</p>}
      <table data-testid="tenants-table" style={{ width: '100%', textAlign: 'left' }}>
        <thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {tenants.map(t => (
            <tr key={t.id}>
              <td>{t.customerName}</td>
              <td>
                {t.status === 'active' ? t.plan : (
                  <select
                    aria-label={`Plan for ${t.customerName}`}
                    value={plans[t.customerId] || t.plan}
                    onChange={e => setPlans({ ...plans, [t.customerId]: e.target.value })}
                  >
                    {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
              </td>
              <td>{t.status}</td>
              <td>
                {t.status !== 'active' && (
                  <button
                    className="tab active"
                    disabled={busyId === t.customerId}
                    onClick={() => provision(t.customerId, plans[t.customerId] || t.plan)}
                    aria-label={`Provision ${t.customerName}`}
                  >
                    {busyId === t.customerId ? 'Provisioning...' : 'Provision tenant'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlaceholderTab({ title, description }) {
  return (
    <div className="placeholder">
      <h2>{title}</h2>
      <p>{description}</p>
      <p style={{ marginTop: '20px', fontSize: '0.9rem' }}>
        🚧 This section is ready to be built
      </p>
    </div>
  );
}

export default App;
