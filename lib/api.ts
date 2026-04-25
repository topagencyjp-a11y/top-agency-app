const GAS_URL = 'https://script.google.com/macros/s/AKfycbyhbSNrD5-JdXWW4SCnXeUK7bcm3-o1mm8nq4e8wSlAhG9MhHHOELiUoD_QgrztPAOWug/exec';

export async function saveReport(data: any) {
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveReport', ...data }),
    });
  } catch (e) {
    console.error(e);
  }
}

export async function getReports(name?: string) {
  try {
    const url = name ? `${GAS_URL}?action=getReports&name=${encodeURIComponent(name)}` : `${GAS_URL}?action=getReports`;
    const res = await fetch(url);
    const data = await res.json();
    return data.reports || [];
  } catch (e) {
    return [];
  }
}

export async function saveShift(name: string, date: string, status: string) {
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveShift', name, date, status }),
    });
  } catch (e) {
    console.error(e);
  }
}

export async function getShifts() {
  try {
    const res = await fetch(`${GAS_URL}?action=getShifts`);
    const data = await res.json();
    return data.shifts || [];
  } catch (e) {
    return [];
  }
}

export async function getMembersFromGAS() {
  try {
    const res = await fetch(`${GAS_URL}?action=getMembers`);
    const data = await res.json();
    return data.members || [];
  } catch {
    return [];
  }
}

export async function saveMembersToGAS(members: any[]) {
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveMembers', members }),
    });
  } catch (e) {
    console.error(e);
  }
}
