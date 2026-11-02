import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const stats = [
  { label: 'طلبات اليوم', value: '18' },
  { label: 'التسليمات', value: '12' },
  { label: 'الأحياء', value: '5' },
];

const orders = [
  {
    id: '#DL-1042',
    customer: 'سارة أحمد',
    address: 'شارع المسبح، حي النخيل',
    eta: 'في 12 دقيقة',
    status: 'قيد التوصيل',
    priority: 'عاجل',
  },
  {
    id: '#DL-1058',
    customer: 'يوسف خالد',
    address: 'الطريق السريع، عمارة 7',
    eta: 'في 24 دقيقة',
    status: 'مؤكد',
    priority: 'معتدل',
  },
  {
    id: '#DL-1081',
    customer: 'هدى محمد',
    address: 'حي الروضة، بستان 2',
    eta: 'في 39 دقيقة',
    status: 'قيد التجهيز',
    priority: 'عادي',
  },
];

const routeStops = [
  'مستودع EL-SA3D',
  'حي النخيل',
  'الطريق السريع',
  'المدينة الجديدة',
];

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>EL-SA3D PHARMACY</Text>
            <Text style={styles.title}>لوحة التوصيل</Text>
          </View>

          <TouchableOpacity activeOpacity={0.8} style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>متاح</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryGrid}>
          {stats.map((item) => (
            <View key={item.label} style={styles.statCard}>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>الطلبات الحالية</Text>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.linkText}>عرض الكل</Text>
            </TouchableOpacity>
          </View>

          {orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderTopRow}>
                <Text style={styles.orderId}>{order.id}</Text>
                <Text style={styles.priority}>{order.priority}</Text>
              </View>

              <Text style={styles.customerName}>{order.customer}</Text>
              <Text style={styles.address}>{order.address}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>الحالة</Text>
                <Text style={styles.metaValue}>{order.status}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>التوقيت</Text>
                <Text style={styles.metaValue}>{order.eta}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>مسار اليوم</Text>
          {routeStops.map((stop, index) => (
            <View key={stop} style={styles.routeRow}>
              <View style={styles.routeMarkerContainer}>
                <View style={[styles.routeMarker, index === 0 && styles.routeMarkerActive]} />
                {index < routeStops.length - 1 ? <View style={styles.routeLine} /> : null}
              </View>
              <Text style={styles.routeStop}>{stop}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#edf5f1',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  brand: {
    color: '#176b4d',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    marginTop: 8,
    color: '#183c31',
    fontSize: 32,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dff7ea',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1aa66b',
    marginRight: 8,
  },
  statusText: {
    color: '#145b40',
    fontWeight: '700',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statValue: {
    color: '#183c31',
    fontSize: 26,
    fontWeight: '800',
  },
  statLabel: {
    marginTop: 6,
    color: '#5d736c',
    fontSize: 12,
  },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#183c31',
    fontSize: 20,
    fontWeight: '700',
  },
  linkText: {
    color: '#176b4d',
    fontSize: 13,
    fontWeight: '700',
  },
  orderCard: {
    backgroundColor: '#f4faf7',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#dfeae4',
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderId: {
    color: '#1b4f3d',
    fontWeight: '800',
    fontSize: 14,
  },
  priority: {
    backgroundColor: '#e5f6ee',
    borderRadius: 999,
    color: '#176b4d',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  customerName: {
    marginTop: 10,
    color: '#1e3b34',
    fontSize: 18,
    fontWeight: '700',
  },
  address: {
    marginTop: 4,
    color: '#586d66',
    fontSize: 13,
    lineHeight: 20,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    color: '#6d7d77',
    fontSize: 12,
  },
  metaValue: {
    color: '#183c31',
    fontSize: 13,
    fontWeight: '700',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  routeMarkerContainer: {
    alignItems: 'center',
    marginRight: 12,
    width: 18,
  },
  routeMarker: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#bdd7ce',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  routeMarkerActive: {
    backgroundColor: '#1aa66b',
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#cde4da',
    marginTop: 4,
  },
  routeStop: {
    color: '#21473d',
    fontSize: 15,
    fontWeight: '600',
  },
});
