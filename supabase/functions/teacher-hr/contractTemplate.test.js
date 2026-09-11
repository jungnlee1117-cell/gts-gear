import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contractEndDate, buildContractDocument } from './contractTemplate.js';
const base = { teacherName:'박담원', startDate:'2026-09-14', endDate:'2027-09-13', contractDate:'2026-09-14', contractYears:1, rates:[{rate_type:'after_school',amount:50000,unit:'hour'}] };
test('1년 단위 기간, 연말과 윤년 경계를 계산한다', () => {
  assert.equal(contractEndDate('2026-09-14'), '2027-09-13');
  assert.equal(contractEndDate('2026-01-01'), '2026-12-31');
  assert.equal(contractEndDate('2024-02-29'), '2025-02-28');
  assert.equal(contractEndDate('2023-03-01'), '2024-02-29');
  assert.equal(contractEndDate('2026-09-14', 2), '2028-09-13');
  assert.equal(contractEndDate('2026-02-30'), '');
  assert.equal(contractEndDate('2026-09-14', 0), '');
});
test('서버에서도 연 단위 종료일을 검증한다', () => {
  assert.throws(() => buildContractDocument({...base,endDate:'2027-09-14'}), /종료일/);
});
test('정규수업 없이 방과후 금액만 기재한다', () => {
  const doc = buildContractDocument(base);
  assert(!doc.sections[3].paragraphs.join('\n').includes('정규수업:'));
  assert(doc.sections[3].paragraphs.join('\n').includes('50,000원'));
});
test('미리보기 수정문을 PDF용 본문에 반영하고 원본 양식은 보존한다', () => {
  const doc = buildContractDocument({...base,sectionEdits:{'4':'수정한 업무 수행 조항\n두 번째 문단','2.2':'연장 여부는 상호 협의한다.','3.4':'4. 지급일은 익월 15일로 한다.'}});
  assert.deepEqual(doc.sections[4].paragraphs,['수정한 업무 수행 조항','두 번째 문단']);
  assert.equal(doc.sections[2].paragraphs[1],'연장 여부는 상호 협의한다.');
  assert(doc.sections[3].paragraphs.includes('4. 지급일은 익월 15일로 한다.'));
  assert.notEqual(buildContractDocument(base).sections[4].paragraphs[0],'수정한 업무 수행 조항');
});
test('금액 항목 수가 바뀌어도 수정한 지급일은 같은 항에 남는다', () => {
  const doc=buildContractDocument({...base,rates:[{rate_type:'regular',amount:43000,unit:'hour'},...base.rates],sectionEdits:{'3.4':'4. 지급일 수정'}});
  assert(doc.sections[3].paragraphs.includes('4. 지급일 수정'));
  assert(doc.sections[3].paragraphs.includes('정규수업: 시간당 43,000원'));
});
test('잘못된 수정 대상, 빈 조항, 과도한 본문 길이를 거부한다', () => {
  for (const sectionEdits of [{'0':'다른 사람'}, {'2.1':'기간 변경'}, {'999':'잘못된 조항'}, {'4':''}, {'4':'x'.repeat(6001)}, []]) {
    assert.throws(() => buildContractDocument({...base,sectionEdits}));
  }
});
