import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import PackageCard from "../components/PackageCard";
import NewPackageModal from "../components/NewPackageModal";
import SubmissionCard from "../components/SubmissionCard";
import { exportPackagesToExcel, findDuplicateTracking, daysSince, AGING_THRESHOLD_DAYS } from "../utils";

export default function Dashboard({ profile, onLogout }) {
  const [packages, setPackages] = useState([]);
  const [residents, setResidents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [filter, setFilter] = useState("pendente"); // pendente | entregue | todos | conferencia
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: pkgs }, { data: res }, { data: subs }] = await Promise.all([
      supabase.from("packages").select("*").order("received_at", { ascending: false }).limit(300),
      supabase.from("residents").select("*").order("street"),
      supabase
        .from("submissions")
        .select("*")
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setPackages(pkgs || []);
    setResidents(res || []);
    setSubmissions(subs || []);
    setLoading(false);
  }

  async function acceptSubmission(submission) {
    // Verifica duplicidade de código de rastreio antes de aceitar
    const existing = await findDuplicateTracking(submission.tracking_code);
    if (existing) {
      const confirmMsg =
        `Já existe uma encomenda com esse código de rastreio:\n` +
        `${existing.recipient_name} — ${existing.street}${existing.house_number ? ", " + existing.house_number : ""} (status: ${existing.status})\n\n` +
        `Aceitar mesmo assim?`;
      if (!window.confirm(confirmMsg)) return;
    }

    // 1) cria a encomenda de verdade a partir do que o entregador enviou
    const { error: insertError } = await supabase.from("packages").insert({
      recipient_name: submission.recipient_name,
      street: submission.street,
      house_number: submission.house_number,
      carrier: submission.carrier,
      tracking_code: submission.tracking_code,
      description: submission.description,
      courier_name: submission.courier_name,
      courier_cpf: submission.courier_cpf,
      received_by: profile?.id,
      status: "pendente",
      submission_id: submission.id,
      photo_url: submission.photo_url || null,
    });
    if (insertError) return;

    // 2) marca a submissão como aceita
    await supabase
      .from("submissions")
      .update({ status: "aceito", reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
      .eq("id", submission.id);

    setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
    loadData();
  }

  async function rejectSubmission(submission, reason) {
    await supabase
      .from("submissions")
      .update({
        status: "recusado",
        rejection_reason: reason,
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submission.id);

    setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
  }

  async function confirmDelivery(pkg, pickedUpBy) {
    const delivered_at = new Date().toISOString();
    const { error } = await supabase
      .from("packages")
      .update({ status: "entregue", delivered_at, picked_up_by: pickedUpBy || null })
      .eq("id", pkg.id);
    if (!error) {
      setPackages((prev) =>
        prev.map((p) =>
          p.id === pkg.id ? { ...p, status: "entregue", delivered_at, picked_up_by: pickedUpBy || null } : p
        )
      );
    }
  }

  async function registerOccurrence(pkg, occurrenceType, note) {
    const occurrence_at = new Date().toISOString();
    const { error } = await supabase
      .from("packages")
      .update({
        occurrence_type: occurrenceType,
        occurrence_note: note || null,
        occurrence_at,
        occurrence_by: profile?.id,
      })
      .eq("id", pkg.id);
    if (!error) {
      setPackages((prev) =>
        prev.map((p) =>
          p.id === pkg.id
            ? { ...p, occurrence_type: occurrenceType, occurrence_note: note || null, occurrence_at }
            : p
        )
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
    const paradas = packages.filter(
      (p) => p.status === "pendente" && daysSince(p.received_at) >= AGING_THRESHOLD_DAYS
    ).length;
    return { pendentes, entregues, total: packages.length, paradas };
  }, [packages]);

  const filtered = useMemo(() => {
    let list = filter === "todos" || filter === "conferencia" ? packages : packages.filter((p) => p.status === filter);

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (p) =>
          p.recipient_name?.toLowerCase().includes(term) ||
          p.street?.toLowerCase().includes(term) ||
          p.tracking_code?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [packages, filter, search]);

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
        <div className="stats-row stats-row-4">
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
          <div className="stat-card" style={counts.paradas > 0 ? { background: "#FBEAE8" } : {}}>
            <div className="stat-number" style={{ color: counts.paradas > 0 ? "#A6423A" : undefined }}>
              {counts.paradas}
            </div>
            <div className="stat-label">Atenção (7+ dias)</div>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, rua ou código de rastreio..."
          />
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
          <button
            className="btn btn-ghost"
            onClick={() => {
              const link = `${window.location.origin}/nova`;
              navigator.clipboard?.writeText(link);
              alert(`Link copiado!\n\n${link}\n\nUse este link para gerar o QR code (ex.: em qr-code-generator.com) e fixar na guarita.`);
            }}
          >
            Link do entregador
          </button>
        </div>

        <div className="tabs">
          {[
            ["pendente", "Pendentes"],
            ["entregue", "Entregues"],
            ["todos", "Todos"],
            ["conferencia", `Conferência${submissions.length ? ` (${submissions.length})` : ""}`],
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

        {filter === "conferencia" ? (
          loading ? (
            <p className="text-muted">Carregando...</p>
          ) : submissions.length === 0 ? (
            <div className="empty-state">
              <div className="display">Nada para conferir</div>
              <p className="text-muted">
                Quando um entregador cadastrar uma encomenda pelo link público, ela aparece aqui.
              </p>
            </div>
          ) : (
            <div className="package-list">
              {submissions.map((s) => (
                <SubmissionCard
                  key={s.id}
                  submission={s}
                  onAccept={acceptSubmission}
                  onReject={rejectSubmission}
                />
              ))}
            </div>
          )
        ) : loading ? (
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
                    onEdit={setEditingPackage}
                    onRegisterOccurrence={registerOccurrence}
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

      {editingPackage && (
        <NewPackageModal
          profileId={profile?.id}
          editingPackage={editingPackage}
          onClose={() => setEditingPackage(null)}
          onCreated={() => {
            setEditingPackage(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
