import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import PackageCard from "../components/PackageCard";
import NewPackageModal from "../components/NewPackageModal";
import SubmissionCard from "../components/SubmissionCard";
import ResidentModal from "../components/ResidentModal";
import { exportPackagesToExcel, exportSubmissionsToExcel, findDuplicateTracking, daysSince, AGING_THRESHOLD_DAYS } from "../utils";

export default function Dashboard({ profile, onLogout }) {
  const [packages, setPackages] = useState([]);
  const [residents, setResidents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [teamProfiles, setTeamProfiles] = useState([]);
  const [filter, setFilter] = useState("pendente"); // pendente | entregue | todos | conferencia | moradores | equipe
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [showResidentModal, setShowResidentModal] = useState(false);
  const [editingResident, setEditingResident] = useState(null);
  const [residentSearch, setResidentSearch] = useState("");
  const [search, setSearch] = useState("");
  const [confView, setConfView] = useState("pendente"); // pendente | recusado | aceito | todas
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: pkgs }, { data: res }, { data: subs }, { data: team }] = await Promise.all([
      supabase.from("packages").select("*").order("received_at", { ascending: false }).limit(300),
      supabase.from("residents").select("*").order("street"),
      supabase
        .from("submissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("profiles").select("*").order("created_at"),
    ]);
    setPackages(pkgs || []);
    setResidents(res || []);
    setSubmissions(subs || []);
    setTeamProfiles(team || []);
    setLoading(false);
  }

  function nameForProfileId(id) {
    if (!id) return null;
    return teamProfiles.find((p) => p.id === id)?.full_name || null;
  }

  const isSindico = profile?.role === "sindico";

  async function updateTeamMemberRole(member, newRole) {
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", member.id);
    if (!error) {
      setTeamProfiles((prev) => prev.map((p) => (p.id === member.id ? { ...p, role: newRole } : p)));
    } else {
      alert("Não foi possível atualizar. Só síndicos podem alterar papéis da equipe.");
    }
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
    const reviewed_at = new Date().toISOString();
    await supabase
      .from("submissions")
      .update({ status: "aceito", reviewed_by: profile?.id, reviewed_at })
      .eq("id", submission.id);

    setSubmissions((prev) =>
      prev.map((s) => (s.id === submission.id ? { ...s, status: "aceito", reviewed_by: profile?.id, reviewed_at } : s))
    );
    loadData();
  }

  async function rejectSubmission(submission, reason) {
    const reviewed_at = new Date().toISOString();
    const { error } = await supabase
      .from("submissions")
      .update({
        status: "recusado",
        rejection_reason: reason,
        reviewed_by: profile?.id,
        reviewed_at,
      })
      .eq("id", submission.id);

    if (!error) {
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submission.id
            ? { ...s, status: "recusado", rejection_reason: reason, reviewed_by: profile?.id, reviewed_at }
            : s
        )
      );
    }
  }

  async function confirmDelivery(pkg, pickedUpBy) {
    const delivered_at = new Date().toISOString();
    const { error } = await supabase
      .from("packages")
      .update({ status: "entregue", delivered_at, picked_up_by: pickedUpBy || null, delivered_by: profile?.id })
      .eq("id", pkg.id);
    if (!error) {
      setPackages((prev) =>
        prev.map((p) =>
          p.id === pkg.id
            ? { ...p, status: "entregue", delivered_at, picked_up_by: pickedUpBy || null, delivered_by: profile?.id }
            : p
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

  async function deleteResident(resident) {
    if (!isSindico) {
      alert("Só síndicos podem remover moradores. Peça para um síndico da equipe fazer isso.");
      return;
    }
    if (!window.confirm(`Remover ${resident.full_name} da lista de moradores?`)) return;
    const { error } = await supabase.from("residents").delete().eq("id", resident.id);
    if (!error) {
      setResidents((prev) => prev.filter((r) => r.id !== resident.id));
    }
  }

  const filteredResidents = useMemo(() => {
    const term = residentSearch.trim().toLowerCase();
    if (!term) return residents;
    return residents.filter(
      (r) =>
        r.full_name?.toLowerCase().includes(term) ||
        r.street?.toLowerCase().includes(term) ||
        r.house_number?.toLowerCase().includes(term)
    );
  }, [residents, residentSearch]);

  const pendingSubmissions = useMemo(() => submissions.filter((s) => s.status === "pendente"), [submissions]);

  const filteredSubmissions = useMemo(() => {
    if (confView === "todas") return submissions;
    return submissions.filter((s) => s.status === confView);
  }, [submissions, confView]);

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
          <span>{profile?.full_name}{profile?.role === "sindico" ? " · Síndico" : " · Porteiro"}</span>
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

        {filter === "equipe" ? null : filter === "moradores" ? (
          <>
            <div className="field" style={{ marginBottom: 16 }}>
              <input
                value={residentSearch}
                onChange={(e) => setResidentSearch(e.target.value)}
                placeholder="Buscar morador por nome, rua ou número..."
              />
            </div>
            <div className="action-bar">
              <button className="btn btn-primary" onClick={() => setShowResidentModal(true)}>
                + Novo morador
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="field" style={{ marginBottom: 16 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, rua ou código de rastreio..."
              />
            </div>

            <div className="action-bar">
              {filter !== "conferencia" && (
                <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
                  + Nova encomenda
                </button>
              )}
              <button
                className="btn btn-ghost"
                onClick={() =>
                  filter === "conferencia"
                    ? exportSubmissionsToExcel(filteredSubmissions, `conferencia-${confView}.xlsx`, nameForProfileId)
                    : exportPackagesToExcel(filtered, `entregas-${filter}.xlsx`, nameForProfileId)
                }
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
          </>
        )}

        <div className="tabs">
          {[
            ["pendente", "Pendentes"],
            ["entregue", "Entregues"],
            ["todos", "Todos"],
            ["conferencia", `Conferência${pendingSubmissions.length ? ` (${pendingSubmissions.length})` : ""}`],
            ["moradores", `Moradores (${residents.length})`],
            ["equipe", "Equipe"],
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

        {filter === "equipe" ? (
          loading ? (
            <p className="text-muted">Carregando...</p>
          ) : (
            <div className="package-list">
              {teamProfiles.map((member) => (
                <div key={member.id} className="package-card">
                  <div className="package-top">
                    <div>
                      <div className="package-recipient">
                        {member.full_name} {member.id === profile?.id && <span className="text-muted">(você)</span>}
                      </div>
                      <div className="package-address">
                        Cadastrado em {new Date(member.created_at).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <span className={`status-pill ${member.role === "sindico" ? "entregue" : "pendente"}`}>
                      {member.role === "sindico" ? "Síndico" : "Porteiro"}
                    </span>
                  </div>
                  {isSindico && member.id !== profile?.id && (
                    <div className="package-actions">
                      {member.role === "sindico" ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => updateTeamMemberRole(member, "porteiro")}>
                          Tornar Porteiro
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" onClick={() => updateTeamMemberRole(member, "sindico")}>
                          Tornar Síndico
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : filter === "moradores" ? (
          loading ? (
            <p className="text-muted">Carregando...</p>
          ) : filteredResidents.length === 0 ? (
            <div className="empty-state">
              <div className="display">Nenhum morador cadastrado</div>
              <p className="text-muted">Cadastre moradores para habilitar o aviso automático por WhatsApp.</p>
            </div>
          ) : (
            <div className="package-list">
              {filteredResidents.map((r) => (
                <div key={r.id} className="package-card">
                  <div className="package-top">
                    <div>
                      <div className="package-recipient">{r.full_name}</div>
                      <div className="package-address">
                        {r.street}{r.house_number ? `, ${r.house_number}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="package-meta">
                    <span>{r.phone ? `Tel: ${r.phone}` : "Sem telefone cadastrado"}</span>
                  </div>
                  {r.notes && <div className="package-desc">{r.notes}</div>}
                  <div className="package-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingResident(r)}>
                      Editar
                    </button>
                    {isSindico && (
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteResident(r)}>
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filter === "conferencia" ? (
          <>
            <div className="tabs" style={{ marginBottom: 14 }}>
              {[
                ["pendente", `Aguardando${pendingSubmissions.length ? ` (${pendingSubmissions.length})` : ""}`],
                ["recusado", "Recusadas"],
                ["aceito", "Aceitas"],
                ["todas", "Todas"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`tab ${confView === value ? "active" : ""}`}
                  onClick={() => setConfView(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {loading ? (
              <p className="text-muted">Carregando...</p>
            ) : filteredSubmissions.length === 0 ? (
              <div className="empty-state">
                <div className="display">
                  {confView === "pendente" ? "Nada para conferir" : "Nenhum registro aqui"}
                </div>
                <p className="text-muted">
                  {confView === "pendente"
                    ? "Quando um entregador cadastrar uma encomenda pelo link público, ela aparece aqui."
                    : "Ainda não há histórico nesta categoria."}
                </p>
              </div>
            ) : (
              <div className="package-list">
                {filteredSubmissions.map((s) => (
                  <SubmissionCard
                    key={s.id}
                    submission={s}
                    onAccept={acceptSubmission}
                    onReject={rejectSubmission}
                    nameForProfileId={nameForProfileId}
                  />
                ))}
              </div>
            )}
          </>
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
                    nameForProfileId={nameForProfileId}
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
      {showResidentModal && (
        <ResidentModal
          onClose={() => setShowResidentModal(false)}
          onSaved={() => {
            setShowResidentModal(false);
            loadData();
          }}
        />
      )}

      {editingResident && (
        <ResidentModal
          editingResident={editingResident}
          onClose={() => setEditingResident(null)}
          onSaved={() => {
            setEditingResident(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
