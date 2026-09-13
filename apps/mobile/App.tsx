import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RULE_SETS, SOURCES, VERIFIED_AT, getRuleSet } from "@isa-lab/tax-engine";
import type { AssetKind, TaxResult } from "@isa-lab/tax-engine";
import { compute } from "./src/compute";
import { pct, won } from "./src/format";
import { DEMO_STATE, KINDS, STORAGE_KEY, initialState, type AppState } from "./src/state";

type Screen = "input" | "result" | "sources";
const WEB_URL = "https://isa-lab.vercel.app";

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [screen, setScreen] = useState<Screen>("input");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 기기에만 저장한다. 서버 없음.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (raw) setState({ ...initialState, ...JSON.parse(raw) }); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  const outcome = useMemo(() => compute(state), [state]);
  const rules = getRuleSet(state.ruleSetId);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={s.header}>
          {screen !== "input" ? (
            <Pressable onPress={() => setScreen(screen === "sources" ? "result" : "input")} hitSlop={12}><Text style={s.link}>‹ 뒤로</Text></Pressable>
          ) : <Text style={s.brand}>덜내</Text>}
          <Text style={s.title}>{screen === "input" ? "올해 실현손익" : screen === "result" ? "세금 비교" : "근거"}</Text>
          <Pressable onPress={() => setSettingsOpen(true)} hitSlop={12}><Text style={s.link}>설정</Text></Pressable>
        </View>

        {screen === "input" && (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
              <Text style={s.lead}>수수료·거래세를 뺀 뒤의 <Text style={s.b}>실현손익</Text>을 만원 단위로 넣으세요. 계좌를 만들기 전에, 내 매매 기준으로 ISA가 얼마를 아끼는지 봅니다.</Text>
              {KINDS.map(({ kind, label, hint }) => (
                <View key={kind} style={s.card}>
                  <Text style={s.cardTitle}>{label}</Text>
                  <Text style={s.hint}>{hint}</Text>
                  <View style={s.row}>
                    <AmountField label="이익" value={state.entries[kind].profit} onChange={(v) => setEntry(kind, "profit", v)} />
                    <AmountField label="손실" value={state.entries[kind].loss} onChange={(v) => setEntry(kind, "loss", v)} />
                  </View>
                </View>
              ))}
              <Pressable style={s.primary} onPress={() => setScreen("result")}><Text style={s.primaryText}>세금 비교하기</Text></Pressable>
              <Pressable style={s.ghost} onPress={() => setState(DEMO_STATE)}><Text style={s.ghostText}>예시로 보기</Text></Pressable>
              <Pressable style={s.ghost} onPress={() => setState({ ...state, entries: initialState.entries })}><Text style={s.ghostText}>지우기</Text></Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {screen === "result" && (
          <ScrollView contentContainerStyle={s.body}>
            <Segmented
              options={RULE_SETS.map((r) => ({ id: r.id, label: r.label }))}
              value={state.ruleSetId}
              onChange={(id) => setState({ ...state, ruleSetId: id })}
            />
            <View style={[s.card, s.hero]}>
              <Text style={s.heroLabel}>ISA로 아끼는 세금 · {state.year}년 · {state.isaType === "isa_general" ? "일반형" : "서민형"}</Text>
              <Text style={s.heroNumber}>{won(outcome.comparison.saved)}</Text>
              <View style={s.row}>
                <Stat label="일반계좌" value={won(outcome.comparison.regular.totalTax)} />
                <Stat label="ISA" value={won(outcome.comparison.isa.totalTax)} />
              </View>
              {!state.holdingSatisfied && <Text style={s.warn}>의무보유 3년을 채우지 않으면 ISA도 일반계좌와 똑같이 과세됩니다.</Text>}
              {rules.status === "proposed" && <Text style={s.warn}>개편안은 발표만 됐고 확정 전입니다. 현행 기준과 나란히 보세요.</Text>}
            </View>
            {outcome.realized.length === 0 && <Text style={s.hint}>입력한 손익이 없습니다. 「예시로 보기」로 먼저 확인해 보세요.</Text>}
            <Breakdown title="일반계좌라면" result={outcome.comparison.regular} />
            <Breakdown title="ISA라면" result={outcome.comparison.isa} />
            {outcome.outsideIsa && (
              <View style={s.card}>
                <Text style={s.cardTitle}>ISA에 담을 수 없는 자산</Text>
                <Text style={s.hint}>{outcome.comparison.excludedKinds.map(kindLabel).join(" · ")} — 어느 계좌든 같은 세금을 냅니다. 비교에서는 뺐습니다.</Text>
                {outcome.outsideIsa.lines.map((l, i) => <Line key={i} label={l.label} rate={l.rate} tax={l.tax} note={l.note} />)}
              </View>
            )}
            <Pressable style={s.primary} onPress={() => setScreen("sources")}><Text style={s.primaryText}>왜 이 세금인지 — 근거 보기</Text></Pressable>
            <Pressable style={s.ghost} onPress={() => setScreen("input")}><Text style={s.ghostText}>입력 고치기</Text></Pressable>
          </ScrollView>
        )}

        {screen === "sources" && (
          <ScrollView contentContainerStyle={s.body}>
            <View style={s.card}>
              <Text style={s.cardTitle}>적용 룰셋 — {rules.label}</Text>
              <Text style={s.hint}>시행일 {rules.effectiveFrom} · 자료 확인일 {VERIFIED_AT}</Text>
              <Rule label="ISA 비과세 한도 (일반형)" v={rules.isa.taxFreeLimitGeneral} />
              <Rule label="ISA 비과세 한도 (서민형)" v={rules.isa.taxFreeLimitLowIncome} />
              <Rule label="한도 초과분 분리과세" v={rules.isa.separateTaxRate} />
              <Rule label="연간 납입한도" v={rules.isa.annualContributionLimit} />
              <Rule label="총 납입한도" v={rules.isa.totalContributionLimit} />
              <Rule label="의무보유" v={rules.isa.mandatoryHoldingYears} />
              <Rule label="배당소득세 (해외·채권 ETF 매매차익)" v={rules.krDividendTaxRate} />
              <Rule label="해외주식 양도소득세" v={rules.overseasCapitalGainTaxRate} />
              <Rule label="해외주식 기본공제" v={rules.overseasCapitalGainDeduction} />
              <Rule label="가상자산 과세 시작" v={rules.cryptoTaxStartYear} />
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>출처</Text>
              {SOURCES.map((src) => (
                <Pressable key={src.url} onPress={() => Linking.openURL(src.url)} style={s.srcRow}><Text style={s.link}>{src.label}</Text></Pressable>
              ))}
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>알려드립니다</Text>
              <Text style={s.hint}>이 앱은 공개된 자료를 정리해 계산하는 도구이며 세무 검토를 받은 것이 아닙니다. 투자 권유가 아니며, 실제 신고·납부는 국세청·증권사 기준을 따르세요. 입력값은 이 기기에만 저장되고 서버로 전송되지 않습니다.</Text>
              <Pressable onPress={() => Linking.openURL(WEB_URL)} style={s.srcRow}><Text style={s.link}>웹에서 종목 단위로 굴려보기 → {WEB_URL}</Text></Pressable>
            </View>
          </ScrollView>
        )}

        <Modal visible={settingsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSettingsOpen(false)}>
          <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
            <View style={s.header}>
              <View style={{ width: 48 }} />
              <Text style={s.title}>설정</Text>
              <Pressable onPress={() => setSettingsOpen(false)} hitSlop={12}><Text style={s.link}>닫기</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={s.body}>
              <Text style={s.cardTitle}>ISA 유형</Text>
              <Segmented options={[{ id: "isa_general", label: "일반형" }, { id: "isa_low_income", label: "서민형" }]} value={state.isaType} onChange={(id) => setState({ ...state, isaType: id as AppState["isaType"] })} />
              <Text style={s.cardTitle}>정산 연도</Text>
              <Segmented options={[{ id: "2026", label: "2026" }, { id: "2027", label: "2027 (코인 과세 시작)" }]} value={String(state.year)} onChange={(id) => setState({ ...state, year: Number(id) as AppState["year"] })} />
              <Text style={s.cardTitle}>룰셋</Text>
              <Segmented options={RULE_SETS.map((r) => ({ id: r.id, label: r.label }))} value={state.ruleSetId} onChange={(id) => setState({ ...state, ruleSetId: id })} />
              <View style={[s.row, { alignItems: "center", justifyContent: "space-between", marginTop: 16 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>의무보유 3년을 채울 예정</Text>
                  <Text style={s.hint}>중간에 해지하면 ISA 혜택이 사라집니다</Text>
                </View>
                <Switch value={state.holdingSatisfied} onValueChange={(v) => setState({ ...state, holdingSatisfied: v })} />
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );

  function setEntry(kind: AssetKind, field: "profit" | "loss", value: string) {
    setState({ ...state, entries: { ...state.entries, [kind]: { ...state.entries[kind], [field]: value } } });
  }
}

function kindLabel(kind: AssetKind): string {
  return KINDS.find((k) => k.kind === kind)?.label ?? kind;
}

function AmountField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputWrap}>
        <TextInput style={s.input} value={value} onChangeText={(t) => onChange(t.replace(/[^\d.]/g, ""))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#9a9a9a" maxLength={9} />
        <Text style={s.unit}>만원</Text>
      </View>
    </View>
  );
}

function Segmented({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} style={[s.segItem, o.id === value && s.segOn]}>
          <Text style={[s.segText, o.id === value && s.segTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}><Text style={s.hint}>{label}</Text><Text style={s.statValue}>{value}</Text></View>
  );
}

function Line({ label, rate, tax, note }: { label: string; rate: number; tax: number; note: string }) {
  return (
    <View style={s.line}>
      <View style={{ flex: 1 }}><Text style={s.lineLabel}>{label}</Text><Text style={s.hint}>{note}</Text></View>
      <View style={{ alignItems: "flex-end" }}><Text style={s.lineTax}>{won(tax)}</Text><Text style={s.hint}>{pct(rate)}</Text></View>
    </View>
  );
}

function Breakdown({ title, result }: { title: string; result: TaxResult }) {
  return (
    <View style={s.card}>
      <View style={[s.row, { justifyContent: "space-between" }]}><Text style={s.cardTitle}>{title}</Text><Text style={s.cardTitle}>{won(result.totalTax)}</Text></View>
      {result.lines.length === 0 && <Text style={s.hint}>과세 항목이 없습니다.</Text>}
      {result.lines.map((l, i) => <Line key={i} label={l.label} rate={l.rate} tax={l.tax} note={l.note} />)}
      {result.assumptions.map((a, i) => <Text key={i} style={s.assume}>· {a}</Text>)}
    </View>
  );
}

function Rule({ label, v }: { label: string; v: { value: number; status: "enacted" | "proposed"; note: string } }) {
  return (
    <View style={s.line}>
      <View style={{ flex: 1 }}><Text style={s.lineLabel}>{label}{v.status === "proposed" ? "  (확정 전)" : ""}</Text><Text style={s.hint}>{v.note}</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f7f5" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  brand: { fontSize: 18, fontWeight: "800", color: "#1f4e9c" },
  title: { fontSize: 17, fontWeight: "700", color: "#1d1d1b" },
  link: { fontSize: 15, color: "#1f4e9c", fontWeight: "600" },
  body: { padding: 16, paddingBottom: 48, gap: 12 },
  lead: { fontSize: 15, lineHeight: 22, color: "#444" },
  b: { fontWeight: "700", color: "#1d1d1b" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e6e3db", gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1d1d1b" },
  hint: { fontSize: 13, color: "#6b6a66", lineHeight: 18 },
  row: { flexDirection: "row", gap: 10 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 12, color: "#6b6a66" },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#d9d6cd", borderRadius: 8, paddingHorizontal: 10, backgroundColor: "#fffdf8" },
  input: { flex: 1, fontSize: 17, paddingVertical: 10, color: "#1d1d1b", textAlign: "right" },
  unit: { fontSize: 13, color: "#6b6a66", marginLeft: 6 },
  primary: { backgroundColor: "#1f4e9c", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  ghost: { paddingVertical: 10, alignItems: "center" },
  ghostText: { color: "#1f4e9c", fontSize: 15, fontWeight: "600" },
  hero: { alignItems: "center", gap: 8 },
  heroLabel: { fontSize: 13, color: "#6b6a66" },
  heroNumber: { fontSize: 34, fontWeight: "800", color: "#0f7b6c" },
  stat: { flex: 1, alignItems: "center", paddingVertical: 8, backgroundColor: "#f2f6fc", borderRadius: 8 },
  statValue: { fontSize: 16, fontWeight: "700", color: "#1d1d1b" },
  warn: { fontSize: 13, color: "#a8321f", textAlign: "center" },
  line: { flexDirection: "row", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#f0ede6" },
  lineLabel: { fontSize: 14, color: "#1d1d1b", fontWeight: "600" },
  lineTax: { fontSize: 15, fontWeight: "700", color: "#1d1d1b" },
  assume: { fontSize: 12, color: "#6b6a66", marginTop: 4 },
  seg: { flexDirection: "row", backgroundColor: "#ebe9e3", borderRadius: 10, padding: 3, marginBottom: 8 },
  segItem: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 8 },
  segOn: { backgroundColor: "#fff" },
  segText: { fontSize: 13, color: "#6b6a66", fontWeight: "600" },
  segTextOn: { color: "#1d1d1b" },
  srcRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#f0ede6" },
});
