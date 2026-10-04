import React from 'react';
import { useAppStore } from '../../store/appStore';
import { NormalSaleScreen } from '../../components/sales/NormalSaleScreen';
import { WandaSaleScreen } from '../../components/sales/WandaSaleScreen';

export default function SaleFormRoute() {
  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const IsWandaFeature = currentOrg?.hasVariablePackFeature ?? false;

  return IsWandaFeature ? <WandaSaleScreen /> : <NormalSaleScreen />;
}
