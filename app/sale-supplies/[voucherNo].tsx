import React from 'react';
import { useAppStore } from '../../store/appStore';
import { NormalSaleSupplyScreen } from '../../components/sale-supplies/NormalSaleSupplyScreen';
import { WandaSaleSupplyScreen } from '../../components/sale-supplies/WandaSaleSupplyScreen';

export default function SaleSupplyFormRoute() {
  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const IsWandaFeature = currentOrg?.hasVariablePackFeature ?? false;

  return IsWandaFeature ? <WandaSaleSupplyScreen /> : <NormalSaleSupplyScreen />;
}
