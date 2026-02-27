import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Dashboard Flow
import { RecyclingHome } from '../USERS/yardmanager-coadmin/screens/RecyclingHome';

// Inventory Module
import { InventoryDashboard } from '../USERS/yardmanager-coadmin/screens/inventory/dashboard/InventoryDashboard';
import { InventoryList } from '../USERS/yardmanager-coadmin/screens/inventory/stock/list/InventoryList';
import { MovementForm } from '../USERS/yardmanager-coadmin/screens/inventory/movements/MovementForm';
import { AIRecommendations } from '../USERS/yardmanager-coadmin/screens/inventory/ai/AIRecommendations';
import { YardManagerDashboard } from '../USERS/yardmanager-coadmin/dashboard/YardManager';
import { ScanCameraScreen } from '../USERS/yardmanager-coadmin/screens/ops/ScanCameraScreen';
import YardManagerFieldsScreen from '../USERS/yardmanager-coadmin/screens/ops/YardManagerFieldsScreen';

// Owner & Admin
import { OwnerDashboard } from '../USERS/owner-admin/dashboard/OwnerDashboard';
import { StaffList } from '../USERS/yardmanager-coadmin/screens/management/staff/StaffList';
import { AddStaffScreen } from '../USERS/yardmanager-coadmin/screens/management/staff/AddStaffScreen';
import { CheckInScreen } from '../USERS/operator-employee/screens/safety/CheckInScreen';

// Operator
import OperatorsDashboard from '../USERS/operator-employee/dashboard/OperatorsDashboard';
import OperatorInventoryScreen from '../USERS/operator-employee/screens/inventory/Weigh/WeighScreen';
import WeighScreen from '../USERS/operator-employee/screens/inventory/Weigh/WeighScreen';
import DailyReportScreen from '../USERS/operator-employee/screens/inventory/Reports/DailyReportScreen';
import WeighSetupScreen from '../USERS/operator-employee/screens/inventory/Weigh/WeighSetupScreen';
import QCListScreen from '../USERS/operator-employee/screens/quality/QCListScreen';
import QCInspectionScreen from '../USERS/operator-employee/screens/quality/QCInspectionScreen';
import SplitScreen from '../USERS/operator-employee/screens/inventory/Split/SplitScreen';
import SplitAnalyticsScreen from '../USERS/operator-employee/screens/inventory/Split/SplitAnalyticsScreen'; // V2
import InventoryLedgerScreen from '../USERS/operator-employee/screens/inventory/Ledger/InventoryLedgerScreen';
import SalesOrderList from '../USERS/yardmanager-coadmin/screens/inventory/sales/SalesOrderList';
import CreateSalesOrder from '../USERS/yardmanager-coadmin/screens/inventory/sales/CreateSalesOrder';
import SalesOrderDetail from '../USERS/yardmanager-coadmin/screens/inventory/sales/SalesOrderDetail';
import FulfillOrder from '../USERS/yardmanager-coadmin/screens/inventory/sales/FulfillOrder';
import CRMOutstandingScreen from '../USERS/yardmanager-coadmin/screens/inventory/sales/CRMOutstandingScreen';
import SalesConfigScreen from '../USERS/yardmanager-coadmin/screens/inventory/sales/SalesConfigScreen';
import SalesGatewayScreen from '../USERS/yardmanager-coadmin/screens/inventory/sales/SalesGatewayScreen';
import ExternalAPIScreen from '../USERS/yardmanager-coadmin/screens/inventory/sales/ExternalAPIScreen';

// Logistics Module
import { LogisticsHome } from '../USERS/yardmanager-coadmin/screens/logistics/Home';
import { TripsScreen } from '../USERS/yardmanager-coadmin/screens/logistics/Trips';
import { VehiclesScreen } from '../USERS/yardmanager-coadmin/screens/logistics/Vehicles';
import { DriversScreen } from '../USERS/yardmanager-coadmin/screens/logistics/Drivers';
import { CreateTripScreen } from '../USERS/yardmanager-coadmin/screens/logistics/CreateTrip';
import { TripDetailScreen } from '../USERS/yardmanager-coadmin/screens/logistics/TripDetail';
import { DeliveryVerificationScreen } from '../USERS/yardmanager-coadmin/screens/logistics/DeliveryVerification';
import { MyTripsScreen } from '../USERS/operator-employee/screens/logistics/MyTrips';
import { GuardianHub } from '../USERS/owner-admin/screens/safety/GuardianHub';




// Auth
import { AuthRoleScreen } from '../USERS/yardmanager-coadmin/screens/auth/AuthRoleScreen';

export type RecyclingStackParamList = {
    RecyclingHome: undefined;
    AuthRoleScreen: { modules: string[] };
    YardManagerDashboard: undefined;
    YardManagerFieldsScreen: undefined;
    ScanCameraScreen: undefined;
    OwnerDashboard: undefined;
    StaffList: { filterRole?: 'yard_manager' | 'operator' };
    AddStaffScreen: { defaultRole?: 'yard_manager' | 'operator' };
    OperatorsDashboard: undefined;
    CheckIn: undefined;
    OperatorInventoryScreen: undefined;
    WeighSetupScreen: undefined;
    WeighScreen: { materialId: string; supplierId: string; unit: 'kg' | 'ton' };
    InventoryDashboard: undefined;
    InventoryList: undefined;
    MovementForm: { type: string };
    AIRecommendations: undefined;
    DailyReportScreen: undefined;
    QCListScreen: undefined;
    QCInspectionScreen: { batchId: string; logData: any };
    Split: undefined;
    SplitAnalytics: undefined; // V2
    InventoryLedger: undefined;
    SalesOrderList: undefined;
    CreateSalesOrder: undefined;
    SalesOrderDetail: { orderId: string };
    FulfillOrder: { orderId: string; orderItems: any[] };
    CRMOutstanding: undefined;
    SalesConfig: { autoSelect?: 'integrated' | 'external_api' } | undefined;
    SalesGateway: undefined;
    ExternalAPI: undefined;
    LogisticsHome: undefined;
    Trips: undefined;
    Vehicles: undefined;
    Drivers: undefined;
    CreateTrip: undefined;
    TripDetail: { trip: any };
    DeliveryVerification: { trip: any };
    MyTrips: undefined;
    GuardianHub: undefined;
};

const Stack = createNativeStackNavigator<RecyclingStackParamList>();

export const RecyclingNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
            }}
            initialRouteName="RecyclingHome"
        >
            {/* Dashboard Flow */}
            <Stack.Screen name="RecyclingHome" component={RecyclingHome} />
            <Stack.Screen name="AuthRoleScreen" component={AuthRoleScreen} />
            <Stack.Screen name="YardManagerDashboard" component={YardManagerDashboard} />
            <Stack.Screen name="YardManagerFieldsScreen" component={YardManagerFieldsScreen} />
            <Stack.Screen
                name="ScanCameraScreen"
                component={ScanCameraScreen}
            />
            <Stack.Screen
                name="OwnerDashboard"
                component={OwnerDashboard}
            />
            <Stack.Screen
                name="StaffList"
                component={StaffList}
            />
            <Stack.Screen
                name="AddStaffScreen"
                component={AddStaffScreen}
            />
            <Stack.Screen
                name="OperatorsDashboard"
                component={OperatorsDashboard}
            />
            <Stack.Screen name="CheckIn" component={CheckInScreen} />
            <Stack.Screen
                name="OperatorInventoryScreen"
                component={OperatorInventoryScreen}
            />
            <Stack.Screen
                name="WeighSetupScreen"
                component={WeighSetupScreen}
            />
            <Stack.Screen
                name="WeighScreen"
                component={OperatorInventoryScreen}
            />
            <Stack.Screen name="DailyReportScreen" component={DailyReportScreen} />
            <Stack.Screen name="QCListScreen" component={QCListScreen} />
            <Stack.Screen name="QCInspectionScreen" component={QCInspectionScreen} />
            <Stack.Screen name="Split" component={SplitScreen} />
            <Stack.Screen name="SplitAnalytics" component={SplitAnalyticsScreen} />
            <Stack.Screen name="InventoryLedger" component={InventoryLedgerScreen} />

            {/* Inventory Module */}
            <Stack.Screen name="InventoryDashboard" component={InventoryDashboard} />
            <Stack.Screen name="InventoryList" component={InventoryList} />
            <Stack.Screen name="MovementForm" component={MovementForm} />
            <Stack.Screen name="AIRecommendations" component={AIRecommendations} />

            {/* Sales Module */}
            <Stack.Screen name="SalesGateway" component={SalesGatewayScreen} />
            <Stack.Screen name="ExternalAPI" component={ExternalAPIScreen} />
            <Stack.Screen name="SalesOrderList" component={SalesOrderList} />
            <Stack.Screen name="CreateSalesOrder" component={CreateSalesOrder} />
            <Stack.Screen name="SalesOrderDetail" component={SalesOrderDetail} />
            <Stack.Screen name="FulfillOrder" component={FulfillOrder} />
            <Stack.Screen name="CRMOutstanding" component={CRMOutstandingScreen} />
            <Stack.Screen name="SalesConfig" component={SalesConfigScreen} />
            {/* Logistics Module */}
            <Stack.Screen name="LogisticsHome" component={LogisticsHome} />
            <Stack.Screen name="Trips" component={TripsScreen} />
            <Stack.Screen name="Vehicles" component={VehiclesScreen} />
            <Stack.Screen name="Drivers" component={DriversScreen} />
            <Stack.Screen name="CreateTrip" component={CreateTripScreen} />
            <Stack.Screen name="TripDetail" component={TripDetailScreen} />
            <Stack.Screen name="DeliveryVerification" component={DeliveryVerificationScreen} />
            <Stack.Screen name="MyTrips" component={MyTripsScreen} />
            <Stack.Screen name="GuardianHub" component={GuardianHub} />
        </Stack.Navigator>
    );
};