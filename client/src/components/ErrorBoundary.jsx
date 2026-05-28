import { Component } from 'react';
import { Link } from 'react-router-dom';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="auth-page">
          <div className="auth-box">
            <h1>
              Something <span>went wrong</span>
            </h1>
            <p>{this.state.error.message || 'An unexpected error occurred.'}</p>
            <button
              type="button"
              className="auth-btn"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            <Link to="/" className="auth-link">
              &larr; Back to home
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
