import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import PackageCard from "../components/PackageCard";
import NewPackageModal from "../components/NewPackageModal";
import { exportPackagesToExcel } from "../utils";

export default function Dashboard({ profile, onLogout }) {
  const [packages, setPackages] = useState([]);
  const [residents, setResidents] = useState([]);
  const [filter, setFilter] = useState("pendente"); // pendente | entregue | todos
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: pkgs }, { data: res }] = await Promise.all([
      supabase.from("packages").select("*").order("received_at", { ascending: false }).limit(300),
      supabase.from("residents").select("*").order("street"),
    ]);
    setPackages(pkgs || []);
    setResidents(res || []);
    setLoading(false);
  }

  async function confirmDelivery(pkg) {
    const { error } = await supabase
      .from("packages")
      .update({ status: "entregue", delivered_at: new Date().toISOString() })
      .eq("id", pkg.id);
    if (!error) {
      setPackages((prev) =>
        prev.map((p) => (p.id === pkg.id ? { ...p, status: "entregue", delivered_at: new Date().toISOString() } : p))
      );
    }
  }

  function findResidentPhone(pkg) {
    const match = residents.find(
      (r) =>
        r.street.trim().toLowerCase() === pkg.street.trim().toLowerCase() &&
        (r.house_number || "") === (pkg.house_number || "")
    );
    return match?.phone || null;
  }

  const counts = useMemo(() => {
    const pendentes = packages.filter((p) => p.status === "pendente").length;
    const entregues = packages.filter((p) => p.status === "entregue").length;
    return { pendentes, entregues, total: packages.length };
  }, [packages]);

  const filtered = useMemo(() => {
    if (filter === "todos") return packages;
    return packages.filter((p) => p.status === filter);
  }, [packages, filter]);

  const groupedByStreet = useMemo(() => {
    const groups = {};
    for (const pkg of filtered) {
      const key = pkg.street || "Sem rua";
      if (!groups[key]) groups[key] = [];
      groups[key].push(pkg);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <div className="brand-title">Villaggio Paradiso</div>
            <div className="brand-subtitle">Controle de Entregas</div>
          </div>
        </div>
        <div className="topbar-user">
          <span>{profile?.full_name}</span>
          <button className="logout-btn" onClick={onLogout}>Sair</button>
        </div>
      </div>

      <div className="main">
        <div className="stats-row">
          <div className="stat-card pending">
            <div className="stat-number">{counts.pendentes}</div>
            <div className="stat-label">Pendentes</div>
          </div>
          <div className="stat-card delivered">
            <div className="stat-number">{counts.entregues}</div>
            <div className="stat-label">Entregues</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{counts.total}</div>
            <div className="stat-label">Total</div>
          </div>
        </div>

        <div className="action-bar">
          <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
            + Nova encomenda
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => exportPackagesToExcel(filtered, `entregas-${filter}.xlsx`)}
          >
            Exportar Excel
          </button>
        </div>

        <div className="tabs">
          {[
            ["pendente", "Pendentes"],
            ["entregue", "Entregues"],
            ["todos", "Todos"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`tab ${filter === value ? "active" : ""}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-muted">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="display">Nenhuma encomenda por aqui</div>
            <p className="text-muted">Registre uma nova encomenda para começar.</p>
          </div>
        ) : (
          groupedByStreet.map(([street, items]) => (
            <div key={street}>
              <div className="street-divider">
                <span className="street-plaque">{street}</span>
              </div>
              <div className="package-list">
                {items.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    residentPhone={findResidentPhone(pkg)}
                    onConfirmDelivery={confirmDelivery}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {showNewModal && (
        <NewPackageModal
          profileId={profile?.id}
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
