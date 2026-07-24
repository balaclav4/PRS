import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Crosshair, ChevronRight, X, Trash2, Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTheme } from '../../lib/theme';
import { useData } from '../../store/data';

const EMPTY_RIFLE = { name: '', cartridge: '', barrelLength: '', twist: '', notes: '' };
const EMPTY_LOAD = { rifleId: '', bullet: '', powder: '', chargeGr: '', primer: '', brass: '', coalOrCbto: '', velocityFps: '', name: '', caliber: '', sd: '' };

function FormField({ label, value, onChangeText, placeholder, colors, keyboardType }) {
  return (
    <View style={s.field}>
      <Text style={[s.fieldLabel, { color: colors.mut }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.fnt}
        keyboardType={keyboardType}
        style={[s.fieldInput, { backgroundColor: colors.input, borderColor: colors.ibd, color: colors.tx }]}
      />
    </View>
  );
}

export default function EquipmentScreen() {
  const { colors } = useTheme();
  const { rifles, loads, addRifle, updateRifle, deleteRifle, addLoad, updateLoad, deleteLoad } = useData();
  const [rifleModal, setRifleModal] = useState(null);
  const [loadModal, setLoadModal] = useState(null);

  const openAddRifle = () => setRifleModal({ ...EMPTY_RIFLE, _isNew: true });
  const openEditRifle = (r) => setRifleModal({ ...r, _isNew: false });
  const openAddLoad = () => setLoadModal({ ...EMPTY_LOAD, _isNew: true, rifleId: rifles[0]?.id || '' });
  const openEditLoad = (l) => setLoadModal({ ...l, _isNew: false });

  const saveRifle = () => {
    if (!rifleModal.name.trim()) return;
    if (rifleModal._isNew) {
      addRifle({ name: rifleModal.name, cartridge: rifleModal.cartridge, barrelLength: rifleModal.barrelLength, twist: rifleModal.twist, notes: rifleModal.notes });
    } else {
      updateRifle(rifleModal.id, { name: rifleModal.name, cartridge: rifleModal.cartridge, barrelLength: rifleModal.barrelLength, twist: rifleModal.twist, notes: rifleModal.notes });
    }
    setRifleModal(null);
  };

  const confirmDeleteRifle = () => {
    const doDelete = () => { deleteRifle(rifleModal.id); setRifleModal(null); };
    if (Platform.OS === 'web') { if (confirm('Delete this rifle?')) doDelete(); }
    else Alert.alert('Delete Rifle', 'Are you sure?', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: doDelete }]);
  };

  const saveLoad = () => {
    if (!loadModal.bullet.trim() || !loadModal.powder.trim()) return;
    const data = {
      rifleId: loadModal.rifleId, bullet: loadModal.bullet, powder: loadModal.powder,
      chargeGr: parseFloat(loadModal.chargeGr) || 0, primer: loadModal.primer, brass: loadModal.brass,
      coalOrCbto: parseFloat(loadModal.coalOrCbto) || 0, velocityFps: parseInt(loadModal.velocityFps) || 0,
      name: `${loadModal.bullet} / ${loadModal.powder}`, caliber: loadModal.caliber || '',
      sd: parseFloat(loadModal.sd) || 0,
    };
    if (loadModal._isNew) addLoad(data);
    else updateLoad(loadModal.id, data);
    setLoadModal(null);
  };

  const confirmDeleteLoad = () => {
    const doDelete = () => { deleteLoad(loadModal.id); setLoadModal(null); };
    if (Platform.OS === 'web') { if (confirm('Delete this load?')) doDelete(); }
    else Alert.alert('Delete Load', 'Are you sure?', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: doDelete }]);
  };

  const updateRifleField = (field, val) => setRifleModal(prev => ({ ...prev, [field]: val }));
  const updateLoadField = (field, val) => setLoadModal(prev => ({ ...prev, [field]: val }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: colors.tx }]}>Equipment</Text>

        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.tx }]}>RIFLES</Text>
          <TouchableOpacity onPress={openAddRifle} style={s.addBtn}>
            <Plus size={15} color={colors.act} />
            <Text style={[s.addText, { color: colors.act }]}>Add</Text>
          </TouchableOpacity>
        </View>

        {rifles.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <Crosshair size={28} color={colors.fnt} />
            <Text style={[s.emptyText, { color: colors.mut }]}>No rifles yet</Text>
            <TouchableOpacity onPress={openAddRifle} style={[s.emptyBtn, { backgroundColor: colors.acs }]}>
              <Text style={[s.emptyBtnText, { color: colors.act }]}>Add your first rifle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.list}>
            {rifles.map((r) => (
              <TouchableOpacity key={r.id} onPress={() => openEditRifle(r)} style={[s.rifleRow, { backgroundColor: colors.card, borderColor: colors.bd }]}>
                <View style={[s.iconWrap, { backgroundColor: colors.acs }]}>
                  <Crosshair size={21} color={colors.act} />
                </View>
                <View style={s.mid}>
                  <Text style={[s.name, { color: colors.tx }]}>{r.name}</Text>
                  <Text style={[s.spec, { color: colors.mut }]}>{r.cartridge} · {r.barrelLength} {r.twist ? `· ${r.twist}` : ''}</Text>
                </View>
                <ChevronRight size={18} color={colors.fnt} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={[s.sectionHeader, { marginTop: 24 }]}>
          <Text style={[s.sectionTitle, { color: colors.tx }]}>LOADS</Text>
          <TouchableOpacity onPress={openAddLoad} style={s.addBtn}>
            <Plus size={15} color={colors.act} />
            <Text style={[s.addText, { color: colors.act }]}>Add</Text>
          </TouchableOpacity>
        </View>

        {loads.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
            <Text style={[s.emptyText, { color: colors.mut }]}>No loads yet</Text>
            <TouchableOpacity onPress={openAddLoad} style={[s.emptyBtn, { backgroundColor: colors.acs }]}>
              <Text style={[s.emptyBtnText, { color: colors.act }]}>Add your first load</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.list}>
            {loads.map((l) => (
              <TouchableOpacity key={l.id} onPress={() => openEditLoad(l)} style={[s.loadRow, { backgroundColor: colors.card, borderColor: colors.bd }]}>
                <View style={s.loadHeader}>
                  <Text style={[s.name, { color: colors.tx }]}>{l.name}</Text>
                  <View style={[s.calBadge, { backgroundColor: colors.acs }]}>
                    <Text style={[s.calText, { color: colors.act }]}>{l.caliber}</Text>
                  </View>
                </View>
                <View style={s.loadStats}>
                  <View>
                    <Text style={[s.loadStatVal, { color: colors.tx }]}>{l.chargeGr}gr</Text>
                    <Text style={[s.loadStatLabel, { color: colors.fnt }]}>CHARGE</Text>
                  </View>
                  <View>
                    <Text style={[s.loadStatVal, { color: colors.tx }]}>{l.velocityFps}</Text>
                    <Text style={[s.loadStatLabel, { color: colors.fnt }]}>MV</Text>
                  </View>
                  <View>
                    <Text style={[s.loadStatVal, { color: colors.tx }]}>{l.sd}</Text>
                    <Text style={[s.loadStatLabel, { color: colors.fnt }]}>SD</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Rifle Modal */}
      <Modal visible={rifleModal !== null} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.bg }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.tx }]}>{rifleModal?._isNew ? 'Add Rifle' : 'Edit Rifle'}</Text>
              <TouchableOpacity onPress={() => setRifleModal(null)}><X size={22} color={colors.mut} /></TouchableOpacity>
            </View>
            <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
              <FormField label="Name" value={rifleModal?.name} onChangeText={v => updateRifleField('name', v)} placeholder="e.g. Impact 737R" colors={colors} />
              <FormField label="Cartridge" value={rifleModal?.cartridge} onChangeText={v => updateRifleField('cartridge', v)} placeholder="e.g. 6.5 Creedmoor" colors={colors} />
              <FormField label="Barrel Length" value={rifleModal?.barrelLength} onChangeText={v => updateRifleField('barrelLength', v)} placeholder={'e.g. 26"'} colors={colors} />
              <FormField label="Twist Rate" value={rifleModal?.twist} onChangeText={v => updateRifleField('twist', v)} placeholder="e.g. 1:8" colors={colors} />
              <FormField label="Notes" value={rifleModal?.notes} onChangeText={v => updateRifleField('notes', v)} placeholder="Optional" colors={colors} />
            </ScrollView>
            <View style={s.modalActions}>
              {!rifleModal?._isNew && (
                <TouchableOpacity onPress={confirmDeleteRifle} style={[s.deleteBtn, { backgroundColor: colors.dngs }]}>
                  <Trash2 size={17} color={colors.dngt} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={saveRifle} style={[s.saveBtn, { opacity: rifleModal?.name?.trim() ? 1 : 0.4 }]}>
                <Check size={17} color="#fff" />
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Load Modal */}
      <Modal visible={loadModal !== null} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.bg }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.tx }]}>{loadModal?._isNew ? 'Add Load' : 'Edit Load'}</Text>
              <TouchableOpacity onPress={() => setLoadModal(null)}><X size={22} color={colors.mut} /></TouchableOpacity>
            </View>
            <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: colors.mut }]}>Rifle</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {rifles.map(r => (
                      <TouchableOpacity key={r.id} onPress={() => updateLoadField('rifleId', r.id)}
                        style={[s.chipBtn, { backgroundColor: loadModal?.rifleId === r.id ? colors.act : colors.inset, borderColor: loadModal?.rifleId === r.id ? colors.act : colors.ibd }]}>
                        <Text style={[s.chipText, { color: loadModal?.rifleId === r.id ? '#fff' : colors.tx }]}>{r.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <FormField label="Caliber" value={loadModal?.caliber} onChangeText={v => updateLoadField('caliber', v)} placeholder="e.g. 6.5 CM" colors={colors} />
              <FormField label="Bullet" value={loadModal?.bullet} onChangeText={v => updateLoadField('bullet', v)} placeholder="e.g. 140 Hybrid" colors={colors} />
              <FormField label="Powder" value={loadModal?.powder} onChangeText={v => updateLoadField('powder', v)} placeholder="e.g. H4350" colors={colors} />
              <FormField label="Charge (gr)" value={String(loadModal?.chargeGr || '')} onChangeText={v => updateLoadField('chargeGr', v)} placeholder="e.g. 41.8" colors={colors} keyboardType="decimal-pad" />
              <FormField label="Primer" value={loadModal?.primer} onChangeText={v => updateLoadField('primer', v)} placeholder="e.g. Fed 210M" colors={colors} />
              <FormField label="Brass" value={loadModal?.brass} onChangeText={v => updateLoadField('brass', v)} placeholder="e.g. Lapua" colors={colors} />
              <FormField label="COAL / CBTO" value={String(loadModal?.coalOrCbto || '')} onChangeText={v => updateLoadField('coalOrCbto', v)} placeholder="e.g. 2.825" colors={colors} keyboardType="decimal-pad" />
              <FormField label="Velocity (fps)" value={String(loadModal?.velocityFps || '')} onChangeText={v => updateLoadField('velocityFps', v)} placeholder="e.g. 2820" colors={colors} keyboardType="number-pad" />
              <FormField label="SD (fps)" value={String(loadModal?.sd || '')} onChangeText={v => updateLoadField('sd', v)} placeholder="e.g. 8.4" colors={colors} keyboardType="decimal-pad" />
            </ScrollView>
            <View style={s.modalActions}>
              {!loadModal?._isNew && (
                <TouchableOpacity onPress={confirmDeleteLoad} style={[s.deleteBtn, { backgroundColor: colors.dngs }]}>
                  <Trash2 size={17} color={colors.dngt} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={saveLoad} style={[s.saveBtn, { opacity: (loadModal?.bullet?.trim() && loadModal?.powder?.trim()) ? 1 : 0.4 }]}>
                <Check size={17} color="#fff" />
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addText: { fontSize: 13, fontWeight: '700' },
  list: { gap: 10 },
  rifleRow: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderRadius: 16, padding: 15 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700' },
  spec: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  loadRow: { borderWidth: 1, borderRadius: 16, padding: 15 },
  loadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  calText: { fontSize: 11, fontWeight: '700' },
  loadStats: { flexDirection: 'row', gap: 16, marginTop: 11 },
  loadStatVal: { fontSize: 14, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  loadStatLabel: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: 30, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, fontWeight: '600' },
  emptyBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, marginTop: 4 },
  emptyBtnText: { fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalContent: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 34, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalScroll: { marginBottom: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderRadius: 12, padding: 13, paddingHorizontal: 15, fontSize: 15 },
  chipBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  chipText: { fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10 },
  deleteBtn: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#6D3BEB', height: 48, borderRadius: 14 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
