import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.brand}>EL-SA3D PHARMACY</Text>
      <Text style={styles.title}>أهلاً بك</Text>
      <Text style={styles.status}>Customer mobile workspace is running.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f3f7f4',
  },
  brand: {
    color: '#176b4d',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    marginTop: 24,
    color: '#183c31',
    fontSize: 42,
    fontWeight: '700',
  },
  status: {
    marginTop: 8,
    color: '#53675e',
    fontSize: 16,
  },
});
