import Layout from '../components/Layout';

export default function Favourites() {
  return (
    <Layout>
      <div className="page-header">
        <h1>Favourites</h1>
      </div>
      <div className="card">
        <div className="empty-state">No favourites saved yet.</div>
      </div>
    </Layout>
  );
}
