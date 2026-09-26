/**
 * @format
 */

import { useState } from 'react';
import { StatusBar, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SplashScreen } from './src/screens/SplashScreen';
import { LandParcelsScreen } from './src/screens/LandParcelsScreen';
import { CreateLandParcelScreen } from './src/screens/CreateLandParcelScreen';
import { ParcelDetailScreen } from './src/screens/ParcelDetailScreen';
import { LegalCheckScreen } from './src/screens/LegalCheckScreen';
import { GovernmentApprovalsScreen } from './src/screens/GovernmentApprovalsScreen';
import { LandTenureScreen } from './src/screens/LandTenureScreen';
import { FinancialStructureScreen } from './src/screens/FinancialStructureScreen';
import { EscrowAccountScreen } from './src/screens/EscrowAccountScreen';
import { CertificationPacketScreen } from './src/screens/CertificationPacketScreen';
import { LenderCovenantScreen } from './src/screens/LenderCovenantScreen';
import { AccountingSyncScreen } from './src/screens/AccountingSyncScreen';
import { GSTFilingScreen } from './src/screens/GSTFilingScreen';
import { TDSFilingScreen } from './src/screens/TDSFilingScreen';
import { TPAReportScreen } from './src/screens/TPAReportScreen';
import { LitigationCaseScreen } from './src/screens/LitigationCaseScreen';
import { RiskRegisterScreen } from './src/screens/RiskRegisterScreen';
import { TenderScreen } from './src/screens/TenderScreen';
import { MasterScheduleScreen } from './src/screens/MasterScheduleScreen';
import { AuditTrailScreen } from './src/screens/AuditTrailScreen';
import { ParcelComparisonScreen } from './src/screens/ParcelComparisonScreen';
import { DEV_PROJECT_ID } from './src/config/devProject';

// No navigation library yet — this is the whole app's routing until there are enough screens
// (or enough back-stack complexity) to justify the dependency. A plain tagged-union route
// covers "list -> detail -> legal check -> approvals -> land tenure -> financials -> escrow ->
// certification packet -> lender covenant -> accounting sync -> GST filing -> TDS filing ->
// TPA report".
type Route =
  | { name: 'splash' }
  | { name: 'list' }
  | { name: 'createParcel' }
  | { name: 'parcelDetail'; parcelId: string }
  | { name: 'legalCheck'; parcelId: string }
  | { name: 'approvals'; parcelId: string }
  | { name: 'landTenure'; parcelId: string }
  | { name: 'financialStructure'; parcelId: string }
  | { name: 'escrowAccount'; parcelId: string }
  | { name: 'certificationPacket'; parcelId: string }
  | { name: 'lenderCovenant'; parcelId: string }
  | { name: 'accountingSync'; parcelId: string }
  | { name: 'gstFiling'; parcelId: string }
  | { name: 'tdsFiling'; parcelId: string }
  | { name: 'tpaReport'; parcelId: string }
  | { name: 'litigationCase'; parcelId: string }
  | { name: 'riskRegister'; parcelId: string }
  | { name: 'tender'; parcelId: string }
  | { name: 'masterSchedule'; parcelId: string }
  | { name: 'auditTrail' }
  | { name: 'compareParcels'; parcelIds: string[] };

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [route, setRoute] = useState<Route>({ name: 'splash' });

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {route.name === 'splash' && (
          <SplashScreen onFinish={() => setRoute({ name: 'list' })} />
        )}
        {route.name === 'list' && (
          <LandParcelsScreen
            onSelectParcel={parcelId =>
              setRoute({ name: 'parcelDetail', parcelId })
            }
            onSeeAuditTrail={() => setRoute({ name: 'auditTrail' })}
            onAddParcel={() => setRoute({ name: 'createParcel' })}
            onCompareParcels={parcelIds =>
              setRoute({ name: 'compareParcels', parcelIds })
            }
          />
        )}
        {route.name === 'createParcel' && (
          <CreateLandParcelScreen
            onBack={() => setRoute({ name: 'list' })}
            onCreated={() => setRoute({ name: 'list' })}
          />
        )}
        {route.name === 'parcelDetail' && (
          <ParcelDetailScreen
            parcelId={route.parcelId}
            onBack={() => setRoute({ name: 'list' })}
            onSeeLegalCheck={() =>
              setRoute({ name: 'legalCheck', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'legalCheck' && (
          <LegalCheckScreen
            parcelId={route.parcelId}
            onBack={() =>
              setRoute({ name: 'parcelDetail', parcelId: route.parcelId })
            }
            onDealClosed={() =>
              setRoute({ name: 'approvals', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'approvals' && (
          <GovernmentApprovalsScreen
            parcelId={route.parcelId}
            onBack={() =>
              setRoute({ name: 'legalCheck', parcelId: route.parcelId })
            }
            onSeeLandTenure={() =>
              setRoute({ name: 'landTenure', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'landTenure' && (
          <LandTenureScreen
            projectId={DEV_PROJECT_ID}
            onBack={() =>
              setRoute({ name: 'approvals', parcelId: route.parcelId })
            }
            onSeeFinancialStructure={() =>
              setRoute({ name: 'financialStructure', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'financialStructure' && (
          <FinancialStructureScreen
            projectId={DEV_PROJECT_ID}
            onBack={() =>
              setRoute({ name: 'landTenure', parcelId: route.parcelId })
            }
            onSeeEscrowAccount={() =>
              setRoute({ name: 'escrowAccount', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'escrowAccount' && (
          <EscrowAccountScreen
            projectId={DEV_PROJECT_ID}
            onBack={() =>
              setRoute({ name: 'financialStructure', parcelId: route.parcelId })
            }
            onSeeCertificationPacket={() =>
              setRoute({ name: 'certificationPacket', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'certificationPacket' && (
          <CertificationPacketScreen
            projectId={DEV_PROJECT_ID}
            onBack={() =>
              setRoute({ name: 'escrowAccount', parcelId: route.parcelId })
            }
            onSeeLenderCovenant={() =>
              setRoute({ name: 'lenderCovenant', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'lenderCovenant' && (
          <LenderCovenantScreen
            projectId={DEV_PROJECT_ID}
            onBack={() =>
              setRoute({ name: 'certificationPacket', parcelId: route.parcelId })
            }
            onSeeAccountingSync={() =>
              setRoute({ name: 'accountingSync', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'accountingSync' && (
          <AccountingSyncScreen
            projectId={DEV_PROJECT_ID}
            onBack={() =>
              setRoute({ name: 'lenderCovenant', parcelId: route.parcelId })
            }
            onSeeGSTFiling={() =>
              setRoute({ name: 'gstFiling', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'gstFiling' && (
          <GSTFilingScreen
            projectId={DEV_PROJECT_ID}
            onBack={() =>
              setRoute({ name: 'accountingSync', parcelId: route.parcelId })
            }
            onSeeTDSFiling={() =>
              setRoute({ name: 'tdsFiling', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'tdsFiling' && (
          <TDSFilingScreen
            projectId={DEV_PROJECT_ID}
            onBack={() =>
              setRoute({ name: 'gstFiling', parcelId: route.parcelId })
            }
            onSeeTPAReport={() =>
              setRoute({ name: 'tpaReport', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'tpaReport' && (
          <TPAReportScreen
            projectId={DEV_PROJECT_ID}
            onBack={() =>
              setRoute({ name: 'tdsFiling', parcelId: route.parcelId })
            }
            onSeeLitigation={() =>
              setRoute({ name: 'litigationCase', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'litigationCase' && (
          <LitigationCaseScreen
            onBack={() =>
              setRoute({ name: 'tpaReport', parcelId: route.parcelId })
            }
            onSeeRiskRegister={() =>
              setRoute({ name: 'riskRegister', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'riskRegister' && (
          <RiskRegisterScreen
            projectId={DEV_PROJECT_ID}
            onBack={() =>
              setRoute({ name: 'litigationCase', parcelId: route.parcelId })
            }
            onProceedToTendering={() =>
              setRoute({ name: 'tender', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'tender' && (
          <TenderScreen
            projectId={DEV_PROJECT_ID}
            onBack={() =>
              setRoute({ name: 'riskRegister', parcelId: route.parcelId })
            }
            onConfirmSetSchedule={() =>
              setRoute({ name: 'masterSchedule', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'masterSchedule' && (
          <MasterScheduleScreen
            projectId={DEV_PROJECT_ID}
            onBack={() =>
              setRoute({ name: 'tender', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'auditTrail' && (
          <AuditTrailScreen onBack={() => setRoute({ name: 'list' })} />
        )}
        {route.name === 'compareParcels' && (
          <ParcelComparisonScreen
            parcelIds={route.parcelIds}
            onBack={() => setRoute({ name: 'list' })}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
