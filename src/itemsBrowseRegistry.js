/** App.jsx 의 ItemsBrowsePage 를 키오스크 등에서 순환 import 없이 재사용하기 위한 레지스트리 */

let ItemsBrowsePageComponent = null;

export function registerItemsBrowsePage(Component) {
  ItemsBrowsePageComponent = Component;
}

export function getItemsBrowsePage() {
  return ItemsBrowsePageComponent;
}
