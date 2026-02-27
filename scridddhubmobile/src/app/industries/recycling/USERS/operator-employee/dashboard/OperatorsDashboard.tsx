// @refresh reset
import React from "react";
import DashboardHome from "./DashboardHome";
import OperatorLayout from "./OperatorLayout";

export default function OperatorsDashboard({ navigation, route }: any) {
    return (
        <OperatorLayout navigation={navigation} route={route} title="Operator Dashboard">
            <DashboardHome navigation={navigation} />
        </OperatorLayout>
    );
}
