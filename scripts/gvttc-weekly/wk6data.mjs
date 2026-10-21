// Week 6 fixtures, transcribed from the six paper scorecards (7 Oct 2026).
// `table` is the handwritten 台 number on the sheet; home = the A/B/C side.
// `pairs` lists [home slot, away slot] per match where a sheet's rows didn't
// follow the printed A-X, B-Y, C-Z… order. A match recorded only as a result,
// with no game scores, is 'H' (home won 3-0) or 'A'.
export const WEEK = 6
export const DATE_LABEL = '7 October 2026'

export const fixtures = [
  {
    table: 1,
    home: { name: 'Team Infinite', players: ['Roy Huang', 'David Yifeng Xu', 'Ding Hao Zuo'] },
    away: { name: 'Happy', players: ['Yau Man Cheng', 'Brian Liu', 'Eric Cheung'] },
    games: [
      [[11,3],[11,5],[9,11],[11,9]],
      [[11,3],[11,1],[11,4]],
      [[11,5],[11,1],[11,5]],
      [[11,3],[11,4],[11,6]],
      [[11,5],[11,6],[11,8]],
      [[11,1],[11,8],[11,6]],
      [[11,9],[11,5],[11,6]],
      [[11,4],[11,3],[11,4]],
      [[11,0],[11,2],[11,7]],
    ],
    queries: [],
    final: [9, 0],
  },
  {
    table: 2,
    home: { name: 'Ever Green', players: ['Osama Tadros', 'Danny Jiang', 'Brian T.H. Wong'] },
    away: { name: '金刚葫芦队', players: ['Sean Xiang Zhu', 'Steven G.Q. Chen', 'Alexander Lu'] },
    // Played in a different order from the printed sheet; every pairing
    // still happened exactly once.
    pairs: [[0,0],[1,2],[0,2],[2,2],[0,1],[2,0],[1,1],[1,0],[2,1]],
    games: [
      [[8,11],[11,6],[11,9],[11,5]],
      [[11,7],[11,6],[11,5]],
      [[11,7],[11,3],[11,9]],
      [[11,8],[11,8],[11,7]],
      [[11,4],[11,3],[11,7]],
      [[11,5],[11,8],[11,5]],
      [[11,8],[11,5],[11,4]],
      [[11,2],[11,3],[11,3]],
      [[11,1],[11,1],[11,6]],
    ],
    queries: [],
    final: [9, 0],
  },
  {
    table: 3,
    home: { name: 'Team Karami', players: ['Frank Cao', 'Yi Xin Wang', 'James J. Suo'] },
    away: { name: 'Tri Froce', players: ['Amanda Zhu', 'Yiwen Pan', 'Jinyuan Zhang'] },
    games: [
      [[11,9],[11,7],[11,9]],
      [[11,8],[11,8],[9,11],[11,8]],
      [[6,11],[7,11],[12,10],[8,11]],
      [[11,9],[11,13],[8,11],[11,9],[8,11]],
      [[11,8],[11,7],[7,11],[9,11],[11,8]],
      [[7,11],[11,7],[11,7],[11,6]],
      [[8,11],[11,9],[11,8],[11,6]],
      [[7,11],[11,6],[12,14],[11,7],[7,11]],
      [[11,9],[11,8],[3,11],[4,11],[11,13]],
    ],
    queries: [],
    final: [5, 4],
  },
  {
    table: 4,
    home: { name: 'Fin', players: ['Lester Lee', 'Joson Hsu', 'Nan Li'] },
    away: { name: 'Xero', players: ['Adrian Nusalim', 'Alan Ong', 'Bill Xu'] },
    games: [
      [[11,8],[11,8],[11,5]],
      [[11,5],[11,3],[11,5]],
      [[11,4],[11,9],[11,6]],
      [[11,5],[11,7],[11,2]],
      [[11,9],[11,6],[7,11],[11,5]],
      [[9,11],[11,2],[9,11],[11,9],[11,6]],
      [[14,12],[11,4],[11,5]],
      [[15,13],[11,7],[13,11]],
      [[11,1],[11,5],[11,2]],
    ],
    queries: [],
    final: [9, 0],
  },
  {
    table: 5,
    home: { name: 'Master Pong', players: ['Weizhong Ji', 'Cheong Lam He', 'Guang Yang'] },
    away: { name: 'White Rock Elite', players: ['Wells Luo', 'Nick Zhou', 'Guoxi Chen'] },
    games: [
      [[11,9],[12,10],[14,16],[11,7]],
      [[11,4],[8,11],[11,7],[11,6]],
      'H',
      [[11,6],[8,11],[10,12],[11,7],[11,4]],
      [[11,6],[11,4],[11,9]],
      'H',
      [[5,11],[11,9],[11,4],[11,4]],
      [[9,11],[11,3],[11,7],[11,6]],
      'H',
    ],
    queries: [],
    final: [9, 0],
  },
  {
    table: 6,
    home: { name: 'Burnaby North', players: ['Hao Kun Lei', 'Yue Fang', 'Avi Voth'] },
    away: { name: 'Spin Power', players: ['Alan Shea', 'Hamid Gharachamani', 'Davood Hasanloo'] },
    games: [
      [[11,6],[11,4],[11,7]],
      [[11,6],[11,4],[12,10]],
      [[3,11],[3,11],[5,11]],
      [[11,7],[11,3],[11,8]],
      [[12,10],[11,13],[11,9],[11,4]],
      [[4,11],[9,11],[16,14],[7,11]],
      [[11,7],[11,6],[8,11],[8,11],[6,11]],
      [[11,5],[11,4],[11,4]],
      [[6,11],[8,11],[5,11]],
    ],
    queries: [],
    final: [5, 4],
  },
]

// All lineup names are confirmed; nothing is marked as inferred.
export const inferred = {}
