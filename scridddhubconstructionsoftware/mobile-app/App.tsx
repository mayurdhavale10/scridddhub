/**
 * @format
 */

import { useEffect, useState } from 'react';
import { BackHandler, StatusBar, StyleSheet, useColorScheme } from 'react-native';
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
import { PinLocationScreen } from './src/screens/PinLocationScreen';
import { ParcelHubScreen, type HubTarget } from './src/screens/ParcelHubScreen';
import { OrderReportScreen } from './src/screens/OrderReportScreen';
import { ReportScreen } from './src/screens/ReportScreen';
import { SevenTwelveScreen } from './src/screens/SevenTwelveScreen';
import { AddSaleScreen } from './src/screens/AddSaleScreen';
import { FerfarScreen } from './src/screens/FerfarScreen';
import { FetchQueueScreen } from './src/screens/FetchQueueScreen';
import { DEV_PROJECT_ID } from './src/config/devProject';

// Tapping a parcel opens its hub (ParcelHubScreen): one card per screen, and Back from any of
// them returns to the hub (owner, 2026-10-03). The "next →" links between screens remain.
// No navigation library yet — this is the whole app's routing until there are enough screens
// (or enough back-stack complexity) to justify the dependency. A plain tagged-union route
// covers "list -> detail -> legal check -> approvals -> land tenure -> financials -> escrow ->
// certification packet -> lender covenant -> accounting sync -> GST filing -> TDS filing ->
// TPA report".
type Route =
  | { name: 'splash' }
  | { name: 'list' }
  | { name: 'createParcel' }
  | { name: 'parcelHub'; parcelId: string }
  | { name: 'orderReport'; parcelId: string }
  | { name: 'report'; parcelId: string; reportId: string }
  | { name: 'sevenTwelve'; parcelId: string; reportId?: string }
  | { name: 'addSale'; parcelId: string; reportId: string }
  | { name: 'ferfar'; parcelId: string; reportId: string }
  | { name: 'parcelDetail'; parcelId: string }
  | { name: 'pinLocation'; parcelId: string }
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
  | { name: 'records' }
  | { name: 'compareParcels'; parcelIds: string[] };

// Where the phone's Back button goes: the same place each screen's ← goes. null = leave the app.
function parentOf(route: Route): Route | null {
  switch (route.name) {
    case 'splash':
    case 'list':
      return null;
    case 'parcelHub':
    case 'createParcel':
    case 'auditTrail':
    case 'records':
    case 'compareParcels':
      return { name: 'list' };
    case 'report':
      return { name: 'orderReport', parcelId: route.parcelId };
    case 'addSale':
    case 'ferfar':
      return { name: 'report', parcelId: route.parcelId, reportId: route.reportId };
    case 'sevenTwelve':
      return route.reportId
        ? { name: 'report', parcelId: route.parcelId, reportId: route.reportId }
        : { name: 'orderReport', parcelId: route.parcelId };
    case 'pinLocation':
      return { name: 'parcelDetail', parcelId: route.parcelId };
    default:
      return { name: 'parcelHub', parcelId: route.parcelId };
  }
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [route, setRoute] = useState<Route>({ name: 'splash' });

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const parent = parentOf(route);
      if (!parent) return false; // let Android close the app from the list
      setRoute(parent);
      return true;
    });
    return () => sub.remove();
  }, [route]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {route.name === 'splash' && (
          <SplashScreen onFinish={() => setRoute({ name: 'list' })} />
        )}
        {route.name === 'list' && (
          <LandParcelsScreen
            onSelectParcel={parcelId => setRoute({ name: 'parcelHub', parcelId })}
            onSeeAuditTrail={() => setRoute({ name: 'auditTrail' })}
            onOpenRecords={() => setRoute({ name: 'records' })}
            onAddParcel={() => setRoute({ name: 'createParcel' })}
            onCompareParcels={parcelIds =>
              setRoute({ name: 'compareParcels', parcelIds })
            }
          />
        )}
        {route.name === 'records' && <FetchQueueScreen onBack={() => setRoute({ name: 'list' })} />}
        {route.name === 'createParcel' && (
          <CreateLandParcelScreen
            onBack={() => setRoute({ name: 'list' })}
            onCreated={() => setRoute({ name: 'list' })}
          />
        )}
        {route.name === 'parcelHub' && (
          <ParcelHubScreen
            parcelId={route.parcelId}
            onBack={() => setRoute({ name: 'list' })}
            onOpen={(target: HubTarget) =>
              setRoute(
                target === 'feasibility'
                  ? { name: 'parcelDetail', parcelId: route.parcelId }
                  : // Every other HubTarget is also a route name taking a parcelId.
                    ({ name: target, parcelId: route.parcelId } as Route),
              )
            }
          />
        )}
        {route.name === 'orderReport' && (
          <OrderReportScreen
            parcelId={route.parcelId}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onOpenLegalCheck={() => setRoute({ name: 'legalCheck', parcelId: route.parcelId })}
            onOpenReport={reportId => setRoute({ name: 'report', parcelId: route.parcelId, reportId })}
          />
        )}
        {route.name === 'report' && (
          <ReportScreen
            reportId={route.reportId}
            onBack={() => setRoute({ name: 'orderReport', parcelId: route.parcelId })}
            onOpenLegalCheck={() => setRoute({ name: 'legalCheck', parcelId: route.parcelId })}
            onOpenSevenTwelve={() => setRoute({ name: 'sevenTwelve', parcelId: route.parcelId, reportId: route.reportId })}
            onOpenSales={() => setRoute({ name: 'addSale', parcelId: route.parcelId, reportId: route.reportId })}
            onOpenFerfar={() => setRoute({ name: 'ferfar', parcelId: route.parcelId, reportId: route.reportId })}
          />
        )}
        {route.name === 'ferfar' && (
          <FerfarScreen
            parcelId={route.parcelId}
            onBack={() => setRoute({ name: 'report', parcelId: route.parcelId, reportId: route.reportId })}
          />
        )}
        {route.name === 'addSale' && (
          <AddSaleScreen
            parcelId={route.parcelId}
            onBack={() => setRoute({ name: 'report', parcelId: route.parcelId, reportId: route.reportId })}
          />
        )}
        {route.name === 'sevenTwelve' && (
          <SevenTwelveScreen
            parcelId={route.parcelId}
            onBack={() =>
              setRoute(
                route.reportId
                  ? { name: 'report', parcelId: route.parcelId, reportId: route.reportId }
                  : { name: 'orderReport', parcelId: route.parcelId },
              )
            }
          />
        )}
        {route.name === 'parcelDetail' && (
          <ParcelDetailScreen
            parcelId={route.parcelId}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onSeeLegalCheck={() =>
              setRoute({ name: 'legalCheck', parcelId: route.parcelId })
            }
            onPinLocation={() =>
              setRoute({ name: 'pinLocation', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'pinLocation' && (
          <PinLocationScreen
            parcelId={route.parcelId}
            onBack={() => setRoute({ name: 'parcelDetail', parcelId: route.parcelId })}
            onSaved={() =>
              setRoute({ name: 'parcelDetail', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'legalCheck' && (
          <LegalCheckScreen
            parcelId={route.parcelId}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onDealClosed={() =>
              setRoute({ name: 'approvals', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'approvals' && (
          <GovernmentApprovalsScreen
            parcelId={route.parcelId}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onSeeLandTenure={() =>
              setRoute({ name: 'landTenure', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'landTenure' && (
          <LandTenureScreen
            parcelId={route.parcelId}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onSeeFinancialStructure={() =>
              setRoute({ name: 'financialStructure', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'financialStructure' && (
          <FinancialStructureScreen
            projectId={DEV_PROJECT_ID}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onSeeEscrowAccount={() =>
              setRoute({ name: 'escrowAccount', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'escrowAccount' && (
          <EscrowAccountScreen
            projectId={DEV_PROJECT_ID}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onSeeCertificationPacket={() =>
              setRoute({
                name: 'certificationPacket',
                parcelId: route.parcelId,
              })
            }
          />
        )}
        {route.name === 'certificationPacket' && (
          <CertificationPacketScreen
            projectId={DEV_PROJECT_ID}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onSeeLenderCovenant={() =>
              setRoute({ name: 'lenderCovenant', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'lenderCovenant' && (
          <LenderCovenantScreen
            projectId={DEV_PROJECT_ID}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onSeeAccountingSync={() =>
              setRoute({ name: 'accountingSync', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'accountingSync' && (
          <AccountingSyncScreen
            projectId={DEV_PROJECT_ID}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onSeeGSTFiling={() =>
              setRoute({ name: 'gstFiling', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'gstFiling' && (
          <GSTFilingScreen
            projectId={DEV_PROJECT_ID}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onSeeTDSFiling={() =>
              setRoute({ name: 'tdsFiling', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'tdsFiling' && (
          <TDSFilingScreen
            projectId={DEV_PROJECT_ID}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onSeeTPAReport={() =>
              setRoute({ name: 'tpaReport', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'tpaReport' && (
          <TPAReportScreen
            projectId={DEV_PROJECT_ID}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onSeeLitigation={() =>
              setRoute({ name: 'litigationCase', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'litigationCase' && (
          <LitigationCaseScreen
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onSeeRiskRegister={() =>
              setRoute({ name: 'riskRegister', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'riskRegister' && (
          <RiskRegisterScreen
            projectId={DEV_PROJECT_ID}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onProceedToTendering={() =>
              setRoute({ name: 'tender', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'tender' && (
          <TenderScreen
            projectId={DEV_PROJECT_ID}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
            onConfirmSetSchedule={() =>
              setRoute({ name: 'masterSchedule', parcelId: route.parcelId })
            }
          />
        )}
        {route.name === 'masterSchedule' && (
          <MasterScheduleScreen
            projectId={DEV_PROJECT_ID}
            onBack={() => setRoute({ name: 'parcelHub', parcelId: route.parcelId })}
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
