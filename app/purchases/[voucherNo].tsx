import React from 'react';
import { useAppStore } from '../../store/appStore';
import { NormalPurchaseScreen } from '../../components/purchases/NormalPurchaseScreen';
import { WandaPurchaseScreen } from '../../components/purchases/WandaPurchaseScreen';

export default function PurchaseFormRoute() {
  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const IsWandaFeature = currentOrg?.hasVariablePackFeature ?? false;

  return IsWandaFeature ? <WandaPurchaseScreen /> : <NormalPurchaseScreen />;
}
